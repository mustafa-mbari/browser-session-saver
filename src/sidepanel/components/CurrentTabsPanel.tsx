import { useState, useCallback, useEffect } from 'react';
import { Layers, MoreVertical, Pin, Copy, Trash2 } from 'lucide-react';
import type { ToastData } from '@shared/components/Toast';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import EmptyState from '@shared/components/EmptyState';
import Badge from '@shared/components/Badge';
import ContextMenu from '@shared/components/ContextMenu';

interface CurrentTabsPanelProps {
  query: string;
  onToast: (toast: Omit<ToastData, 'id'>) => void;
}

export default function CurrentTabsPanel({ query, onToast }: CurrentTabsPanelProps) {
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
