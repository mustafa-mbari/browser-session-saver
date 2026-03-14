import { useMemo, useState, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useSearch } from '@shared/hooks/useSearch';
import { useSidePanelStore } from '../stores/sidepanel.store';
import QuickActions from '../components/QuickActions';
import SearchBar from '../components/SearchBar';
import SessionList from '../components/SessionList';
import Toast, { type ToastData } from '@shared/components/Toast';
import { generateId } from '@core/utils/uuid';
import type { SessionFilter, SessionSort } from '@core/types/messages.types';

export default function HomeView() {
  const { sessions, loading } = useSession();
  const { activeFilter, sortBy, sortDirection } = useSidePanelStore();
  const [toasts, setToasts] = useState<ToastData[]>([]);

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
      return true;
    });
  }, [sessions, activeFilter]);

  const { filteredSessions, setQuery } = useSearch(filteredByType);

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

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    setToasts((prev) => [...prev, { id: generateId(), message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <QuickActions />
      <SearchBar onSearch={setQuery} />
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

      {/* Toast Container */}
      <div className="fixed bottom-12 left-2 right-2 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  );
}
