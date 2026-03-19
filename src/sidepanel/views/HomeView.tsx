import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ExternalLink, Download, Trash2, X, Layers, MoreVertical, Pin, Copy, RotateCcw, History, Edit2, Check, ChevronDown, ChevronRight, XCircle, Monitor, RefreshCw } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useSearch } from '@shared/hooks/useSearch';
import { useSidePanelStore } from '../stores/sidepanel.store';
import QuickActions from '../components/QuickActions';
import SearchBar from '../components/SearchBar';
import SessionList from '../components/SessionList';
import Toast, { type ToastData } from '@shared/components/Toast';
import Button from '@shared/components/Button';
import EmptyState from '@shared/components/EmptyState';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import Badge from '@shared/components/Badge';
import ContextMenu from '@shared/components/ContextMenu';
import { generateId } from '@core/utils/uuid';
import type { SessionFilter } from '@core/types/messages.types';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { Session, ChromeGroupColor } from '@core/types/session.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { GROUP_COLORS } from '@core/constants/tab-group-colors';
import { formatRelative } from '@core/utils/date';

const PROMPT_KEY = 'session_restore_prompt';
const PROMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type HomeTab = 'session' | 'tab' | 'tab-group';

const HOME_TABS: { key: HomeTab; label: string }[] = [
  { key: 'session',   label: 'Session' },
  { key: 'tab',       label: 'Tab' },
  { key: 'tab-group', label: 'Tab Group' },
];

const SEARCH_PLACEHOLDERS: Record<HomeTab, string> = {
  session: 'Search sessions… (#tag to filter)',
  tab: 'Search open tabs…',
  'tab-group': 'Search tab groups…',
};

export default function HomeView() {
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>('session');
  const [searchQuery, setSearchQuery] = useState('');
  const { sessions, loading, deleteSession, restoreSession } = useSession();
  const { activeFilter, sortBy, sortDirection, selectedSessionIds, isSelectionMode, clearSelection } = useSidePanelStore();
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

  const handleTabChange = useCallback((tab: HomeTab) => {
    setActiveHomeTab(tab);
    setSearchQuery('');
  }, []);

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

  return (
    <div className="flex flex-col h-full">
      {/* Modern segmented tab bar */}
      <div className="mx-3 my-2.5 flex bg-[var(--color-bg-secondary)] rounded-lg p-0.5 gap-0.5">
        {HOME_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
              activeHomeTab === tab.key
                ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
            aria-selected={activeHomeTab === tab.key}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar — always visible, adapts per tab */}
      <SearchBar
        onSearch={handleSearch}
        placeholder={SEARCH_PLACEHOLDERS[activeHomeTab]}
        showFilters={activeHomeTab === 'session'}
      />

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
        <TabGroupsPanel sessions={sessions} loading={loading} query={searchQuery} onToast={addToast} />
      )}

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <button
          onClick={() => {
            chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
          }}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <ExternalLink size={12} />
          Open Dashboard
        </button>
        <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Quick Actions — at the bottom */}
      <QuickActions onToast={addToast} />

      {/* Bulk Action Toolbar */}
      {isSelectionMode && selectedSessionIds.size > 0 && (
        <div className="fixed bottom-[calc(var(--qa-height,148px)+8px)] left-2 right-2 z-50 flex items-center gap-2 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-card shadow-card">
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

// ── Current Tabs Panel ────────────────────────────────────────────────────────

interface CurrentTabsPanelProps {
  query: string;
  onToast: (toast: Omit<ToastData, 'id'>) => void;
}

function CurrentTabsPanel({ query, onToast }: CurrentTabsPanelProps) {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const q = query.toLowerCase();

  const refreshTabs = useCallback(() => {
    chrome.tabs.query({ currentWindow: true }, (result) => {
      setTabs(result);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refreshTabs();
  }, [refreshTabs]);

  const handlePin = useCallback(async (tab: chrome.tabs.Tab) => {
    if (!tab.id) return;
    await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
    refreshTabs();
  }, [refreshTabs]);

  const handleDuplicate = useCallback(async (tab: chrome.tabs.Tab) => {
    if (!tab.id) return;
    await chrome.tabs.duplicate(tab.id);
    refreshTabs();
    onToast({ message: 'Tab duplicated', type: 'success' });
  }, [refreshTabs, onToast]);

  const handleClose = useCallback(async (tab: chrome.tabs.Tab) => {
    if (!tab.id) return;
    await chrome.tabs.remove(tab.id);
    refreshTabs();
    onToast({ message: 'Tab closed', type: 'success' });
  }, [refreshTabs, onToast]);

  const filtered = q
    ? tabs.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.url?.toLowerCase().includes(q),
      )
    : tabs;

  if (loading) return <LoadingSpinner />;

  if (tabs.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No tabs open"
        description="Open tabs in this window will appear here."
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No results"
        description={`No tabs matching "${query}"`}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {filtered.map((tab) => (
        <div
          key={tab.id}
          className="flex items-center gap-2.5 px-3 py-2 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer group"
          onClick={() => tab.id && chrome.tabs.update(tab.id, { active: true })}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' && tab.id) chrome.tabs.update(tab.id, { active: true }); }}
          aria-label={tab.title ?? tab.url ?? 'Tab'}
        >
          {tab.favIconUrl ? (
            <img src={tab.favIconUrl} alt="" className="w-4 h-4 shrink-0 rounded-sm" />
          ) : (
            <div className="w-4 h-4 shrink-0 rounded-sm bg-gray-200 dark:bg-gray-600" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{tab.title || tab.url}</p>
            <p className="text-[10px] text-[var(--color-text-secondary)] truncate">{tab.url}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {tab.active && <Badge variant="primary">Active</Badge>}
            {tab.pinned && <Badge variant="success">Pinned</Badge>}
            <ContextMenu
              items={[
                {
                  label: tab.pinned ? 'Unpin tab' : 'Pin tab',
                  icon: Pin,
                  onClick: () => handlePin(tab),
                },
                {
                  label: 'Duplicate tab',
                  icon: Copy,
                  onClick: () => handleDuplicate(tab),
                },
                {
                  label: 'Close tab',
                  icon: Trash2,
                  onClick: () => handleClose(tab),
                  danger: true,
                },
              ]}
            >
              <button
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Tab actions"
              >
                <MoreVertical size={14} />
              </button>
            </ContextMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab Groups Panel ──────────────────────────────────────────────────────────


interface TGLiveGroup {
  id: number;
  title: string;
  color: ChromeGroupColor;
  collapsed: boolean;
  windowId: number;
  tabs: chrome.tabs.Tab[];
}

interface TabGroupsPanelProps {
  sessions: Session[];
  loading: boolean;
  query: string;
  onToast: (toast: Omit<ToastData, 'id'>) => void;
}

// ── Home Live Group Row ────────────────────────────────────────────────────────

function HomeLiveGroupRow({
  group,
  onRefresh,
  onToast,
}: {
  group: TGLiveGroup;
  onRefresh: () => Promise<void>;
  onToast: (toast: Omit<ToastData, 'id'>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(group.title);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accentColor = GROUP_COLORS[group.color] ?? '#9aa0a6';

  const startEdit = useCallback(() => {
    setDraftTitle(group.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [group.title]);

  const saveEdit = useCallback(async () => {
    setBusy(true);
    try {
      await chrome.tabGroups.update(group.id, { title: draftTitle.trim() || group.title });
      setEditing(false);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }, [group.id, group.title, draftTitle, onRefresh]);

  const handleClose = useCallback(async () => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await TabGroupTemplateStorage.upsert({
        key: `${group.title}-${group.color}`,
        title: group.title,
        color: group.color,
        tabs: group.tabs.map((t) => ({ url: t.url ?? '', title: t.title ?? '', favIconUrl: t.favIconUrl ?? '' })),
        savedAt: now,
        updatedAt: now,
      });
      const tabIds = group.tabs.map((t) => t.id!).filter(Boolean);
      if (tabIds.length > 0) await chrome.tabs.remove(tabIds);
      await onRefresh();
      onToast({ message: 'Group closed and saved', type: 'success' });
    } finally {
      setBusy(false);
    }
  }, [group, onRefresh, onToast]);

  const handleFocus = useCallback(async () => {
    const firstTab = group.tabs[0];
    if (firstTab?.id) {
      await chrome.windows.update(group.windowId, { focused: true });
      await chrome.tabs.update(firstTab.id, { active: true });
    }
  }, [group.tabs, group.windowId]);

  const handleUngroup = useCallback(async () => {
    const tabIds = group.tabs.map((t) => t.id!).filter(Boolean);
    if (tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
      await onRefresh();
    }
  }, [group.tabs, onRefresh]);

  const menuItems = useMemo(() => [
    { label: 'Rename',             icon: Edit2,    onClick: startEdit },
    { label: 'Restore Here',       icon: Monitor,  onClick: () => void handleFocus() },
    { label: 'Close from browser', icon: XCircle,  onClick: () => void handleClose() },
    { label: 'Ungroup',            icon: Trash2,   onClick: () => void handleUngroup(), danger: true },
  ], [startEdit, handleFocus, handleClose, handleUngroup]);

  return (
    <div className="border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-secondary)] transition-colors group">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        {editing ? (
          <>
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="flex-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text)] outline-none focus:border-blue-500"
            />
            <button onClick={() => void saveEdit()} disabled={busy} className="p-1 rounded text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
              <Check size={12} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-[var(--color-bg-secondary)]" style={{ color: 'var(--color-text-secondary)' }}>
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center gap-1 text-left min-w-0"
            >
              <span className="font-medium text-sm truncate">{group.title || 'Unnamed group'}</span>
              {expanded
                ? <ChevronDown size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
            </button>
            <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {group.tabs.length}t
            </span>
            {busy ? (
              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-secondary)' }} />
              </span>
            ) : (
              <ContextMenu items={menuItems}>
                <button
                  className="p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors shrink-0"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label="More actions"
                >
                  <MoreVertical size={13} />
                </button>
              </ContextMenu>
            )}
          </>
        )}
      </div>
      {expanded && !editing && (
        <div className="border-t border-[var(--color-border)] max-h-36 overflow-auto" style={{ background: 'var(--color-bg-secondary)', opacity: 0.9 }}>
          {group.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id && void chrome.tabs.update(tab.id, { active: true })}
              className="w-full flex items-center gap-2 px-5 py-1.5 hover:bg-[var(--color-bg-hover)] text-left transition-colors"
            >
              {tab.favIconUrl
                ? <img src={tab.favIconUrl} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" />
                : <div className="w-3.5 h-3.5 rounded-sm bg-white/10 shrink-0" />}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                {tab.title || tab.url || 'New Tab'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Home Saved Group Row ──────────────────────────────────────────────────────

function HomeSavedGroupRow({
  template,
  onRestore,
  onDelete,
  onRename,
}: {
  template: TabGroupTemplate;
  onRestore: (t: TabGroupTemplate) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onRename: (key: string, newTitle: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(template.title);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accentColor = GROUP_COLORS[template.color] ?? '#9aa0a6';

  const startEdit = useCallback(() => {
    setDraftTitle(template.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [template.title]);

  const saveRename = useCallback(async () => {
    const newTitle = draftTitle.trim();
    if (!newTitle || newTitle === template.title) { setEditing(false); return; }
    setBusy(true);
    try {
      await onRename(template.key, newTitle);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }, [draftTitle, template.title, template.key, onRename]);

  const menuItems = useMemo(() => [
    {
      label: 'Restore',
      icon: RotateCcw,
      onClick: () => {
        setBusy(true);
        void onRestore(template).finally(() => setBusy(false));
      },
    },
    { label: 'Rename', icon: Edit2, onClick: startEdit },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => {
        setBusy(true);
        void onDelete(template.key).finally(() => setBusy(false));
      },
      danger: true,
    },
  ], [template, onRestore, onDelete, startEdit]);

  return (
    <div className="border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-secondary)] transition-colors group">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        {editing ? (
          <>
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="flex-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text)] outline-none focus:border-blue-500"
            />
            <button onClick={() => void saveRename()} disabled={busy} className="p-1 rounded text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
              <Check size={12} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-[var(--color-bg-secondary)]" style={{ color: 'var(--color-text-secondary)' }}>
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center gap-1 text-left min-w-0"
            >
              <span className="font-medium text-sm truncate">{template.title || 'Unnamed group'}</span>
              {expanded
                ? <ChevronDown size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
            </button>
            <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {template.tabs.length}t
            </span>
            {busy ? (
              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-secondary)' }} />
              </span>
            ) : (
              <ContextMenu items={menuItems}>
                <button
                  className="p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors shrink-0"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label="More actions"
                >
                  <MoreVertical size={13} />
                </button>
              </ContextMenu>
            )}
          </>
        )}
      </div>
      {expanded && !editing && (
        <div className="border-t border-[var(--color-border)] max-h-36 overflow-auto" style={{ background: 'var(--color-bg-secondary)', opacity: 0.9 }}>
          {template.tabs.slice(0, 20).map((tab, i) => (
            <div key={i} className="flex items-center gap-2 px-5 py-1.5">
              {tab.favIconUrl
                ? <img src={tab.favIconUrl} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" />
                : <div className="w-3.5 h-3.5 rounded-sm bg-white/10 shrink-0" />}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                {tab.title || tab.url || 'Unknown'}
              </span>
            </div>
          ))}
          {template.tabs.length > 20 && (
            <p className="text-xs text-center py-1 opacity-40" style={{ color: 'var(--color-text-secondary)' }}>
              +{template.tabs.length - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab Groups Panel (main) ────────────────────────────────────────────────────

function TabGroupsPanel({ query, onToast }: TabGroupsPanelProps) {
  const q = query.toLowerCase();
  const [liveGroups, setLiveGroups] = useState<TGLiveGroup[]>([]);
  const [templates, setTemplates] = useState<TabGroupTemplate[]>([]);
  const [panelLoading, setPanelLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPanelLoading(true);
    try {
      const [groups, tabs, allTemplates] = await Promise.all([
        chrome.tabGroups.query({}),
        chrome.tabs.query({}),
        TabGroupTemplateStorage.getAll(),
      ]);
      const tabsByGroup = new Map<number, chrome.tabs.Tab[]>();
      for (const tab of tabs) {
        if (tab.groupId && tab.groupId > 0) {
          const arr = tabsByGroup.get(tab.groupId) ?? [];
          arr.push(tab);
          tabsByGroup.set(tab.groupId, arr);
        }
      }
      const live: TGLiveGroup[] = groups.map((g) => ({
        id: g.id,
        title: g.title || 'Unnamed',
        color: (g.color as ChromeGroupColor) ?? 'grey',
        collapsed: g.collapsed,
        windowId: g.windowId,
        tabs: tabsByGroup.get(g.id) ?? [],
      }));
      setLiveGroups(live);
      setTemplates(allTemplates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

      // Auto-save live groups (skip groups with no Chrome title)
      const now = new Date().toISOString();
      const groupTitleById = new Map(groups.map((g) => [g.id, g.title ?? '']));
      await Promise.all(
        live
          .filter((g) => g.tabs.length > 0 && groupTitleById.get(g.id) !== '')
          .map((g) =>
            TabGroupTemplateStorage.upsert({
              key: `${g.title}-${g.color}`,
              title: g.title,
              color: g.color,
              tabs: g.tabs.map((t) => ({ url: t.url ?? '', title: t.title ?? '', favIconUrl: t.favIconUrl ?? '' })),
              savedAt: now,
              updatedAt: now,
            }),
          ),
      );
    } catch { /* ignore */ } finally {
      setPanelLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const liveKeys = new Set(liveGroups.map((g) => `${g.title}-${g.color}`));
  const offlineTemplates = templates.filter((t) => !liveKeys.has(t.key));

  const filteredLive = liveGroups.filter((g) => !q || g.title.toLowerCase().includes(q));
  const filteredSaved = offlineTemplates.filter((t) => !q || t.title.toLowerCase().includes(q));

  const handleRestoreTemplate = useCallback(async (template: TabGroupTemplate) => {
    const currentWindow = await chrome.windows.getCurrent();
    const windowId = currentWindow.id!;
    const tabIds: number[] = [];
    for (const tab of template.tabs) {
      const created = await chrome.tabs.create({ url: tab.url, windowId, active: false });
      if (created.id) tabIds.push(created.id);
    }
    if (tabIds.length > 0) {
      const gid = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      await chrome.tabGroups.update(gid, { title: template.title, color: template.color });
      await chrome.tabs.update(tabIds[0], { active: true });
    }
    await refresh();
  }, [refresh]);

  const handleDeleteTemplate = useCallback(async (key: string) => {
    await TabGroupTemplateStorage.delete(key);
    setTemplates((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const handleRenameTemplate = useCallback(async (key: string, newTitle: string) => {
    const all = await TabGroupTemplateStorage.getAll();
    const existing = all.find((t) => t.key === key);
    if (!existing) return;
    const newKey = `${newTitle}-${existing.color}`;
    await TabGroupTemplateStorage.upsert({ ...existing, key: newKey, title: newTitle });
    if (newKey !== key) await TabGroupTemplateStorage.delete(key);
    const updated = await TabGroupTemplateStorage.getAll();
    setTemplates(updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);

  if (panelLoading) {
    return <div className="flex items-center justify-center pt-8"><LoadingSpinner /></div>;
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Refresh button */}
      <div className="flex justify-end px-3 pt-1 pb-0.5">
        <button
          onClick={() => void refresh()}
          className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Refresh groups"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* ── Live section ── */}
      <div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text)' }}>Live</span>
          <span className="text-[10px] px-1 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">{filteredLive.length}</span>
        </div>
        {filteredLive.length === 0 ? (
          <p className="text-xs px-3 py-3" style={{ color: 'var(--color-text-secondary)' }}>
            {q ? 'No matching live groups.' : 'No active tab groups in browser.'}
          </p>
        ) : (
          filteredLive.map((g) => (
            <HomeLiveGroupRow key={g.id} group={g} onRefresh={refresh} onToast={onToast} />
          ))
        )}
      </div>

      {/* Section divider */}
      <div className="border-t-2 border-[var(--color-border)]" />

      {/* ── Not Open section ── */}
      <div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60">
          <Layers size={11} style={{ color: 'var(--color-text-secondary)' }} className="shrink-0" />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text)' }}>Not Open</span>
          <span className="text-[10px] px-1 py-0.5 rounded-full bg-white/10 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {filteredSaved.length}
          </span>
        </div>
        {filteredSaved.length === 0 ? (
          <p className="text-xs px-3 py-3" style={{ color: 'var(--color-text-secondary)' }}>
            {q ? 'No matching saved groups.' : 'All saved groups are currently open.'}
          </p>
        ) : (
          filteredSaved.map((t) => (
            <HomeSavedGroupRow
              key={t.key}
              template={t}
              onRestore={handleRestoreTemplate}
              onDelete={handleDeleteTemplate}
              onRename={handleRenameTemplate}
            />
          ))
        )}
      </div>
    </div>
  );
}
