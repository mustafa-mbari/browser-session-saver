import { useState, useMemo, useCallback, memo, useRef } from 'react';
import { Search, RotateCcw, MoreVertical, Pin, Star, Download, Trash2, Lock } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import { formatRelative } from '@core/utils/date';
import ContextMenu from '@shared/components/ContextMenu';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import Tooltip from '@shared/components/Tooltip';
import type { Session, TabGroup } from '@core/types/session.types';
import { GROUP_COLORS } from '@core/constants/tab-group-colors';

function TabGroupPills({ groups }: { groups: TabGroup[] }) {
  if (groups.length === 0) return null;
  const visible = groups.slice(0, 5);
  const remaining = groups.length - 5;
  return (
    <div className="flex items-center gap-1 mt-1">
      {visible.map((g) => (
        <Tooltip key={g.id} content={g.title || g.color}>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: GROUP_COLORS[g.color] ?? '#9CA3AF' }}
          />
        </Tooltip>
      ))}
      {remaining > 0 && (
        <span className="text-[10px]" style={{ color: 'var(--newtab-text-secondary)' }}>
          +{remaining}
        </span>
      )}
    </div>
  );
}

// ── Session Row / Card ─────────────────────────────────────────────────────────

interface SessionRowProps {
  session: Session;
  onRestore: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Session>) => Promise<void>;
  onExport: (id: string, name: string) => Promise<void>;
}

const SessionRow = memo(function SessionRow({
  session, onRestore, onDelete, onUpdate, onExport,
}: SessionRowProps) {
  const [restoring, setRestoring] = useState(false);

  const handleRestore = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoring(true);
    await onRestore(session.id);
    setRestoring(false);
  }, [onRestore, session.id]);

  const menuItems = useMemo(() => [
    {
      label: session.isPinned ? 'Unpin' : 'Pin',
      icon: Pin,
      onClick: () => onUpdate(session.id, { isPinned: !session.isPinned }),
    },
    {
      label: session.isStarred ? 'Unstar' : 'Star',
      icon: Star,
      onClick: () => onUpdate(session.id, { isStarred: !session.isStarred }),
    },
    {
      label: 'Export',
      icon: Download,
      onClick: () => onExport(session.id, session.name),
    },
    {
      label: session.isLocked ? 'Unlock' : 'Lock',
      icon: Lock,
      onClick: () => onUpdate(session.id, { isLocked: !session.isLocked }),
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => onDelete(session.id),
      danger: true,
    },
  ], [session, onUpdate, onExport, onDelete]);

  return (
    <div className="glass-panel rounded-xl px-4 py-3 flex items-start gap-3 group hover:bg-white/5 transition-colors">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {session.isStarred && (
            <Star size={11} fill="currentColor" style={{ color: '#EAB308' }} className="shrink-0" />
          )}
          {session.isPinned && (
            <Pin size={11} style={{ color: '#6366f1' }} className="shrink-0" />
          )}
          <p className="text-sm font-medium truncate" style={{ color: 'var(--newtab-text)' }}>
            {session.name}
          </p>
          {session.isAutoSave && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 leading-tight"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
            >
              Auto
            </span>
          )}
          {session.isLocked && (
            <Lock size={10} className="shrink-0 opacity-50" style={{ color: 'var(--newtab-text-secondary)' }} />
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
          {formatRelative(session.createdAt)} · {session.tabCount} tab{session.tabCount !== 1 ? 's' : ''}
        </p>
        <TabGroupPills groups={session.tabGroups} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/20 disabled:opacity-50"
          style={{ color: 'var(--newtab-text)' }}
          title="Restore session"
          aria-label="Restore session"
        >
          {restoring
            ? <span className="animate-spin inline-block w-3.5 h-3.5 border border-current border-t-transparent rounded-full" />
            : <RotateCcw size={13} />
          }
        </button>
        <ContextMenu items={menuItems}>
          <button
            className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:bg-white/15"
            style={{ color: 'var(--newtab-text-secondary)' }}
            aria-label="More actions"
          >
            <MoreVertical size={13} />
          </button>
        </ContextMenu>
      </div>
    </div>
  );
});

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function SessionsPanel() {
  const { sessions, loading, restoreSession, deleteSession, updateSession } = useSession();
  const { sendMessage } = useMessaging();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.name.toLowerCase().includes(q) || s.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [sessions, query]);

  // Pinned first, then newest first
  const sorted = useMemo(() => {
    const pinned = filtered.filter((s) => s.isPinned);
    const rest = [...filtered.filter((s) => !s.isPinned)].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return [...pinned, ...rest];
  }, [filtered]);

  const handleRestore = useCallback(async (id: string) => {
    await restoreSession(id, 'new_window');
  }, [restoreSession]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSession(id);
  }, [deleteSession]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Session>) => {
    await updateSession(id, updates);
  }, [updateSession]);

  const handleExport = useCallback(async (id: string, name: string) => {
    const res = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: [id], format: 'json' },
    });
    if (res.success && res.data) {
      const blob = new Blob([res.data as string], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [sendMessage]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const COLS = 3;
  const CARD_H = 92; // estimated px per session card (py-3 + 3 content rows)

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_H,
    lanes: COLS,
    overscan: 4,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="pt-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
          Sessions
        </h2>
        <span className="text-sm" style={{ color: 'var(--newtab-text-secondary)' }}>
          {sessions.length} saved
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--newtab-text-secondary)' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions… (#tag to filter)"
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
          style={{ color: 'var(--newtab-text)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        />
      </div>

      {/* Session list */}
      {sorted.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--newtab-text-secondary)' }}>
          <p className="text-base">{query ? 'No sessions match your search' : 'No saved sessions yet'}</p>
          {!query && (
            <p className="text-sm mt-1 opacity-60">Save a session from the side panel to see it here</p>
          )}
        </div>
      ) : sorted.length <= 30 ? (
        /* Small list — plain CSS grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {sorted.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onRestore={handleRestore}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onExport={handleExport}
            />
          ))}
        </div>
      ) : (
        /* Large list — virtualised 3-column grid */
        <div
          ref={scrollRef}
          style={{ height: 'calc(100vh - 290px)', overflowY: 'auto' }}
        >
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => (
              <div
                key={vItem.key}
                style={{
                  position: 'absolute',
                  top: vItem.start,
                  left: `${(vItem.lane / COLS) * 100}%`,
                  width: `${100 / COLS}%`,
                  height: vItem.size,
                  paddingRight: vItem.lane < COLS - 1 ? 4 : 0,
                  paddingLeft: vItem.lane > 0 ? 4 : 0,
                  paddingBottom: 8,
                }}
              >
                <SessionRow
                  session={sorted[vItem.index]}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  onExport={handleExport}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
