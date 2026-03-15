import { memo, useState, useCallback, useMemo, useRef } from 'react';
import { MoreVertical, RotateCcw, RefreshCw, Trash2, Edit, Pin, Star, Download, Lock } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import type { ToastData } from '@shared/components/Toast';
import { formatRelative } from '@core/utils/date';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import ContextMenu from '@shared/components/ContextMenu';
import TabGroupPreview from './TabGroupPreview';

interface SessionCardProps {
  session: Session;
  onToast?: (toast: Omit<ToastData, 'id'>) => void;
}

export default memo(function SessionCard({ session, onToast }: SessionCardProps) {
  const { navigateTo, isSelectionMode, selectedSessionIds, toggleSelection } = useSidePanelStore();
  const { restoreSession, deleteSession, updateSession, updateSessionTabs } = useSession();
  const { sendMessage } = useMessaging();
  const [restoring, setRestoring] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRestore = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setRestoring(true);
      const result = await restoreSession(session.id);
      setRestoring(false);
      if (result.success) {
        const failedUrls = (result.data as { failedUrls?: string[] } | undefined)?.failedUrls;
        if (failedUrls && failedUrls.length > 0) {
          onToast?.({ message: `${failedUrls.length} tab(s) failed to open`, type: 'warning', duration: 8000 });
        } else {
          onToast?.({ message: 'Session restored', type: 'success' });
        }
      } else {
        onToast?.({ message: result.error ?? 'Failed to restore', type: 'error' });
      }
    },
    [restoreSession, session.id, onToast],
  );

  const handleDelete = useCallback(async () => {
    const sessionSnapshot = { ...session };
    const result = await deleteSession(session.id);
    if (result.success) {
      onToast?.({
        message: 'Session deleted',
        type: 'success',
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: async () => {
            await sendMessage({ action: 'UNDELETE_SESSION', payload: { session: sessionSnapshot } });
            window.dispatchEvent(new CustomEvent('session-changed'));
          },
        },
      });
    } else {
      onToast?.({ message: result.error ?? 'Failed to delete', type: 'error' });
    }
  }, [deleteSession, session, onToast, sendMessage]);

  const handleCardClick = useCallback(() => {
    if (isSelectionMode) {
      toggleSelection(session.id);
    } else {
      navigateTo('session-detail', session.id);
    }
  }, [isSelectionMode, toggleSelection, session.id, navigateTo]);

  const handlePointerDown = useCallback(() => {
    if (!isSelectionMode) {
      longPressTimer.current = setTimeout(() => {
        toggleSelection(session.id);
      }, 400);
    }
  }, [isSelectionMode, toggleSelection, session.id]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const menuItems = useMemo(() => [
    {
      label: session.isPinned ? 'Unpin' : 'Pin',
      icon: Pin,
      onClick: () => updateSession(session.id, { isPinned: !session.isPinned }),
    },
    {
      label: session.isStarred ? 'Unstar' : 'Star',
      icon: Star,
      onClick: () => updateSession(session.id, { isStarred: !session.isStarred }),
    },
    {
      label: 'Rename',
      icon: Edit,
      onClick: () => navigateTo('session-detail', session.id),
    },
    {
      label: 'Update',
      icon: RefreshCw,
      onClick: async () => {
        const res = await updateSessionTabs(session.id);
        if (res.success && res.data) {
          const { addedCount } = res.data;
          onToast?.({
            message: addedCount > 0 ? `${addedCount} new tab${addedCount !== 1 ? 's' : ''} added` : 'Already up to date',
            type: 'success',
          });
        } else {
          onToast?.({ message: res.error ?? 'Failed to update', type: 'error' });
        }
      },
    },
    {
      label: 'Export',
      icon: Download,
      onClick: async () => {
        const res = await sendMessage<string>({
          action: 'EXPORT_SESSIONS',
          payload: { sessionIds: [session.id], format: 'json' },
        });
        if (res.success && res.data) {
          const blob = new Blob([res.data as string], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${session.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      },
    },
    {
      label: session.isLocked ? 'Unlock' : 'Lock',
      icon: Lock,
      onClick: () => updateSession(session.id, { isLocked: !session.isLocked }),
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: handleDelete,
      danger: true,
    },
  ], [session, updateSession, updateSessionTabs, navigateTo, sendMessage, handleDelete]);

  const isSelected = selectedSessionIds.has(session.id);

  return (
    <div
      className={`px-3 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer${isSelected ? ' bg-blue-50 dark:bg-blue-900/20' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Session: ${session.name}`}
      aria-pressed={isSelectionMode ? isSelected : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCardClick();
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="flex items-start justify-between gap-2">
        {isSelectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelection(session.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 shrink-0 accent-primary"
            aria-label={`Select ${session.name}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {session.isStarred && <Star size={12} className="text-warning shrink-0 fill-warning" />}
            {session.isPinned && <Pin size={12} className="text-primary shrink-0" />}
            <span className="font-medium text-sm truncate">{session.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {formatRelative(session.createdAt)} · {session.tabCount} tab
              {session.tabCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-1">
            <TabGroupPreview groups={session.tabGroups} />
          </div>
        </div>

        {!isSelectionMode && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="px-2 py-1 text-xs font-medium text-primary bg-blue-50 dark:bg-blue-900/30 rounded-btn hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
              aria-label="Restore session"
            >
              {restoring ? (
                <span className="animate-spin inline-block w-3 h-3 border border-primary border-t-transparent rounded-full" />
              ) : (
                <RotateCcw size={14} />
              )}
            </button>
            <ContextMenu items={menuItems}>
              <button
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="More actions"
              >
                <MoreVertical size={14} />
              </button>
            </ContextMenu>
          </div>
        )}
      </div>
    </div>
  );
});
