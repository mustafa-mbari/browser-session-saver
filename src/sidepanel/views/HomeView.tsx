import { useMemo, useState, useCallback, useEffect } from 'react';
import { ExternalLink, Download, Trash2, X, Layers } from 'lucide-react';
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
import { generateId } from '@core/utils/uuid';
import type { SessionFilter } from '@core/types/messages.types';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { Session, TabGroup } from '@core/types/session.types';

type HomeTab = 'session' | 'tab' | 'tab-group';

const HOME_TABS: { key: HomeTab; label: string }[] = [
  { key: 'session', label: 'Session' },
  { key: 'tab', label: 'Tab' },
  { key: 'tab-group', label: 'Tab Group' },
];

export default function HomeView() {
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>('session');
  const { sessions, loading, deleteSession } = useSession();
  const { activeFilter, sortBy, sortDirection, selectedSessionIds, isSelectionMode, clearSelection } = useSidePanelStore();
  const { sendMessage } = useMessaging();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);

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
      a.download = `session-saver-export-${ids.length}.json`;
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
      {/* Tab Bar */}
      <div className="flex border-b border-[var(--color-border)] px-1">
        {HOME_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveHomeTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
              activeHomeTab === tab.key
                ? 'text-primary'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
            {activeHomeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeHomeTab === 'session' && (
        <>
          <SearchBar onSearch={handleSearch} />
          <SessionList sessions={sortedSessions} loading={loading} onToast={addToast} />
        </>
      )}
      {activeHomeTab === 'tab' && <CurrentTabsPanel />}
      {activeHomeTab === 'tab-group' && <TabGroupsPanel sessions={sessions} loading={loading} />}

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

      {/* Quick Actions — moved to bottom */}
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

function CurrentTabsPanel() {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.tabs.query({ currentWindow: true }, (result) => {
      setTabs(result);
      setLoading(false);
    });
  }, []);

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

  return (
    <div className="flex-1 overflow-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="flex items-center gap-2.5 px-3 py-2 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
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
          {tab.active && (
            <Badge variant="primary">Active</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab Groups Panel ──────────────────────────────────────────────────────────

interface TabGroupsPanelProps {
  sessions: Session[];
  loading: boolean;
}

interface GroupInfo {
  group: TabGroup;
  sessionCount: number;
  totalTabs: number;
}

function TabGroupsPanel({ sessions, loading }: TabGroupsPanelProps) {
  const groups = useMemo((): GroupInfo[] => {
    const groupMap = new Map<string, GroupInfo>();
    for (const session of sessions) {
      for (const group of session.tabGroups) {
        const key = `${group.title}-${group.color}`;
        const existing = groupMap.get(key);
        if (existing) {
          existing.sessionCount++;
          existing.totalTabs += group.tabIds.length;
        } else {
          groupMap.set(key, { group, sessionCount: 1, totalTabs: group.tabIds.length });
        }
      }
    }
    return Array.from(groupMap.values()).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [sessions]);

  if (loading) return <LoadingSpinner />;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No tab groups"
        description="Tab groups from your saved sessions will appear here."
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {groups.map((info, index) => (
        <div
          key={`${info.group.title}-${info.group.color}-${index}`}
          className="px-3 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: `var(--group-${info.group.color})` }}
            />
            <span className="font-medium text-sm truncate">
              {info.group.title || 'Unnamed group'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 ml-5 text-xs text-[var(--color-text-secondary)]">
            <span>{info.totalTabs} tab{info.totalTabs !== 1 ? 's' : ''}</span>
            <span>{info.sessionCount} session{info.sessionCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
