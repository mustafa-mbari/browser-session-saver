import { useMemo, useState, useCallback, useEffect } from 'react';
import { Download, Trash2, X, History } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useSearch } from '@shared/hooks/useSearch';
import { useSidePanelStore, type HomeTab } from '../stores/sidepanel.store';
import MenuGrid from '../components/MenuGrid';
import SearchBar from '../components/SearchBar';
import SessionList from '../components/SessionList';
import CurrentTabsPanel from '../components/CurrentTabsPanel';
import HomeTabGroupsPanel from '../components/HomeTabGroupsPanel';
import FoldersView from './FoldersView';
import PromptsView from './PromptsView';
import SubscriptionsView from './SubscriptionsView';
import Toast, { type ToastData } from '@shared/components/Toast';
import Button from '@shared/components/Button';
import { generateId } from '@core/utils/uuid';
import type { SessionFilter } from '@core/types/messages.types';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { Session } from '@core/types/session.types';
import { formatRelative } from '@core/utils/date';

const PROMPT_KEY = 'session_restore_prompt';
const PROMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const SEARCH_PLACEHOLDERS: Record<HomeTab, string> = {
  session: 'Search sessions… (#tag to filter)',
  tab: 'Search open tabs…',
  'tab-group': 'Search tab groups…',
  folders: 'Search folders…',
  prompts: '',
  subscriptions: '',
};

export default function HomeView() {
  const [searchQuery, setSearchQuery] = useState('');
  const { sessions, loading, deleteSession, restoreSession } = useSession();
  const { activeFilter, sortBy, sortDirection, selectedSessionIds, isSelectionMode, clearSelection, activeHomeTab, activeNavBarTab, openPageFromMenu } = useSidePanelStore();
  const { sendMessage } = useMessaging();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [restorePromptSession, setRestorePromptSession] = useState<Session | null>(null);
  const [restorePromptDismissed, setRestorePromptDismissed] = useState(false);
  const [restoringPrompt, setRestoringPrompt] = useState(false);

  useEffect(() => {
    if (loading || sessions.length === 0) return;
    async function checkRestorePrompt() {
      const record = await new Promise<{ shownAt: number } | undefined>((resolve) =>
        chrome.storage.local.get(PROMPT_KEY, (r) =>
          resolve((r as Record<string, { shownAt: number } | undefined>)[PROMPT_KEY]),
        ),
      );
      if (!record || Date.now() - record.shownAt > PROMPT_MAX_AGE_MS) return;
      const autoSave = sessions.find(s => s.isAutoSave);
      if (autoSave) setRestorePromptSession(autoSave);
    }
    void checkRestorePrompt();
  }, [loading, sessions]);

  const dismissRestorePrompt = useCallback(() => {
    chrome.storage.local.remove(PROMPT_KEY);
    setRestorePromptDismissed(true);
  }, []);

  const handleRestorePrompt = useCallback(async () => {
    if (!restorePromptSession) return;
    setRestoringPrompt(true);
    const result = await restoreSession(restorePromptSession.id, 'new_window');
    setRestoringPrompt(false);
    const id = generateId();
    if (result.success) {
      setToasts((prev) => [...prev, { id, message: 'Session restored in new window', type: 'success' as const }]);
    } else {
      setToasts((prev) => [...prev, { id, message: result.error ?? 'Failed to restore', type: 'error' as const }]);
    }
    dismissRestorePrompt();
  }, [restorePromptSession, restoreSession, dismissRestorePrompt]);

  const filteredByType = useMemo(() => {
    const filter: SessionFilter = {};
    if (activeFilter === 'manual') filter.isAutoSave = false;
    if (activeFilter === 'auto') filter.isAutoSave = true;
    if (activeFilter === 'starred') filter.isStarred = true;
    if (activeFilter === 'pinned') filter.isPinned = true;

    return sessions.filter((s) => {
      if (filter.isAutoSave !== undefined && s.isAutoSave !== filter.isAutoSave) return false;
      if (filter.isStarred && !s.isStarred) return false;
      if (filter.isPinned && !s.isPinned) return false;
      if (tagFilter.length > 0 && !tagFilter.every((tag) => s.tags.includes(tag))) return false;
      return true;
    });
  }, [sessions, activeFilter, tagFilter]);

  const { filteredSessions, setQuery } = useSearch(filteredByType);

  // Reset search when the active tab changes (driven by UnifiedNavBar via store)
  useEffect(() => {
    setSearchQuery('');
    setQuery('');
    setTagFilter([]);
  }, [activeHomeTab, setQuery]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    const tagMatches = q.match(/#(\w+)/g) ?? [];
    const extractedTags = tagMatches.map((t) => t.slice(1).toLowerCase());
    const cleanQuery = q.replace(/#\w+/g, '').trim();
    setQuery(cleanQuery);
    setTagFilter(extractedTags);
  }, [setQuery]);

  const sortedSessions = useMemo(() => {
    const sorted = [...filteredSessions];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'tabs':
          return dir * (a.tabCount - b.tabCount);
        case 'date':
        default:
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    });

    const pinned = sorted.filter((s) => s.isPinned);
    const unpinned = sorted.filter((s) => !s.isPinned);
    return [...pinned, ...unpinned];
  }, [filteredSessions, sortBy, sortDirection]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: generateId() }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleBulkExport = useCallback(async () => {
    const ids = Array.from(selectedSessionIds);
    const response = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: ids, format: 'json' },
    });
    if (response.success && response.data) {
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `browser-hub-export-${ids.length}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    clearSelection();
  }, [selectedSessionIds, sendMessage, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedSessionIds);
    const snapshots = sessions.filter((s) => ids.includes(s.id));
    for (const id of ids) {
      await deleteSession(id);
    }
    clearSelection();
    addToast({
      message: `${ids.length} session${ids.length !== 1 ? 's' : ''} deleted`,
      type: 'success',
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const session of snapshots) {
            await sendMessage({ action: 'UNDELETE_SESSION', payload: { session } });
          }
          window.dispatchEvent(new CustomEvent('session-changed'));
        },
      },
    });
  }, [selectedSessionIds, sessions, deleteSession, clearSelection, addToast, sendMessage]);

  // Menu tab: show card grid
  if (activeNavBarTab === 'menu') {
    return (
      <div className="flex flex-col h-full">
        <MenuGrid onCardClick={openPageFromMenu} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar — hide on folders, prompts, and subscriptions tabs */}
      {activeHomeTab !== 'folders' && activeHomeTab !== 'prompts' && activeHomeTab !== 'subscriptions' && (
        <SearchBar
          key={activeHomeTab}
          onSearch={handleSearch}
          placeholder={SEARCH_PLACEHOLDERS[activeHomeTab]}
          showFilters={activeHomeTab === 'session'}
        />
      )}

      {/* Startup restore banner */}
      {activeHomeTab === 'session' && !restorePromptDismissed && restorePromptSession && (
        <div className="mx-3 mb-1 px-3 py-2 rounded-lg border border-blue-400/30 bg-blue-500/10 flex items-center gap-2">
          <History size={14} className="text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--color-text)] truncate">
              Restore last session?
            </p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {restorePromptSession.tabCount} tab{restorePromptSession.tabCount !== 1 ? 's' : ''} · {formatRelative(restorePromptSession.updatedAt)}
            </p>
          </div>
          <button
            onClick={() => void handleRestorePrompt()}
            disabled={restoringPrompt}
            className="px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-md transition-colors shrink-0"
          >
            {restoringPrompt ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              'Restore'
            )}
          </button>
          <button
            onClick={dismissRestorePrompt}
            className="p-0.5 rounded hover:bg-blue-500/20 text-[var(--color-text-secondary)] shrink-0"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeHomeTab === 'session' && (
        <SessionList sessions={sortedSessions} loading={loading} onToast={addToast} />
      )}
      {activeHomeTab === 'tab' && (
        <CurrentTabsPanel query={searchQuery} onToast={addToast} />
      )}
      {activeHomeTab === 'tab-group' && (
        <HomeTabGroupsPanel sessions={sessions} loading={loading} query={searchQuery} onToast={addToast} />
      )}
      {activeHomeTab === 'folders' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <FoldersView />
        </div>
      )}
      {activeHomeTab === 'prompts' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <PromptsView />
        </div>
      )}
      {activeHomeTab === 'subscriptions' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <SubscriptionsView />
        </div>
      )}

      {/* Footer — only on sessions tab */}
      {activeHomeTab === 'session' && (
        <div className="px-3 py-2 border-t border-[var(--color-border)] flex items-center justify-end text-xs text-[var(--color-text-secondary)]">
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {isSelectionMode && selectedSessionIds.size > 0 && (
        <div className="fixed bottom-24 left-2 right-2 z-50 flex items-center gap-2 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-card shadow-card">
          <span className="text-xs font-medium flex-1">{selectedSessionIds.size} selected</span>
          <Button size="sm" variant="secondary" icon={Download} onClick={handleBulkExport}>Export</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={handleBulkDelete}>Delete</Button>
          <button onClick={clearSelection} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Clear selection">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed bottom-12 left-2 right-2 z-50 space-y-2 pointer-events-none">
        <div className="pointer-events-auto space-y-2">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </div>
    </div>
  );
}
