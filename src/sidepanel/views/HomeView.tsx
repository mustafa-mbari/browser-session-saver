import { useMemo, useState, useCallback } from 'react';
import { ExternalLink, Download, Trash2, X } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useSearch } from '@shared/hooks/useSearch';
import { useSidePanelStore } from '../stores/sidepanel.store';
import QuickActions from '../components/QuickActions';
import SearchBar from '../components/SearchBar';
import SessionList from '../components/SessionList';
import Toast, { type ToastData } from '@shared/components/Toast';
import Button from '@shared/components/Button';
import { generateId } from '@core/utils/uuid';
import type { SessionFilter } from '@core/types/messages.types';
import { useMessaging } from '@shared/hooks/useMessaging';

export default function HomeView() {
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
    // Extract #tag syntax from query
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

    // Pinned sessions always on top
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
      <QuickActions onToast={addToast} />
      <SearchBar onSearch={handleSearch} />
      <SessionList sessions={sortedSessions} loading={loading} onToast={addToast} />

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

      {/* Bulk Action Toolbar */}
      {isSelectionMode && selectedSessionIds.size > 0 && (
        <div className="fixed bottom-12 left-2 right-2 z-50 flex items-center gap-2 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-card shadow-card">
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
