import { memo, useState, useCallback, useMemo } from 'react';
import { MoreVertical, RotateCcw, Trash2, Edit, Pin, Star, Download, Lock } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import { formatRelative } from '@core/utils/date';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import ContextMenu from '@shared/components/ContextMenu';
import TabGroupPreview from './TabGroupPreview';

interface SessionCardProps {
  session: Session;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export default memo(function SessionCard({ session, onToast }: SessionCardProps) {
  const { navigateTo } = useSidePanelStore();
  const { restoreSession, deleteSession, updateSession } = useSession();
  const { sendMessage } = useMessaging();
  const [restoring, setRestoring] = useState(false);

  const handleRestore = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setRestoring(true);
      const result = await restoreSession(session.id);
      setRestoring(false);
      if (result.success) {
        onToast?.('Session restored', 'success');
      } else {
        onToast?.(result.error ?? 'Failed to restore', 'error');
      }
    },
    [restoreSession, session.id, onToast],
  );

  const handleDelete = useCallback(async () => {
    const result = await deleteSession(session.id);
    if (result.success) {
      onToast?.('Session deleted', 'success');
    } else {
      onToast?.(result.error ?? 'Failed to delete', 'error');
    }
  }, [deleteSession, session.id, onToast]);

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
  ], [session, updateSession, navigateTo, sendMessage, handleDelete]);

  return (
    <div
      className="px-3 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
      onClick={() => navigateTo('session-detail', session.id)}
      role="button"
      tabIndex={0}
      aria-label={`Session: ${session.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigateTo('session-detail', session.id);
      }}
    >
      <div className="flex items-start justify-between gap-2">
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
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={14} />
            </button>
          </ContextMenu>
        </div>
      </div>
    </div>
  );
});
