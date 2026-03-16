import { useState, useMemo, useCallback, memo, useRef } from 'react';
import { Search, RotateCcw, MoreVertical, Pin, Star, Download, Trash2, Lock, FolderOpen, Layers2, Clock as ClockIcon, HardDrive } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import { formatRelative } from '@core/utils/date';
import ContextMenu from '@shared/components/ContextMenu';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import Tooltip from '@shared/components/Tooltip';
import SessionBulkToolbar from './SessionBulkToolbar';
import SessionDiffModal from './SessionDiffModal';
import type { Session, TabGroup } from '@core/types/session.types';
import type { SessionDiffResponse } from '@core/types/messages.types';
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

// ── Stats Bar ──────────────────────────────────────────────────────────────────

function SessionStatsBar({ sessions }: { sessions: Session[] }) {
  const totalTabs = sessions.reduce((sum, s) => sum + s.tabCount, 0);
  const autoSaves = sessions.filter((s) => s.isAutoSave).length;
  const estimatedSize = (JSON.stringify(sessions).length / 1024).toFixed(1);

  const stats = [
    { icon: FolderOpen, label: 'Sessions',   value: sessions.length },
    { icon: Layers2,    label: 'Total Tabs', value: totalTabs },
    { icon: ClockIcon,  label: 'Auto-Saves', value: autoSaves },
    { icon: HardDrive,  label: 'Storage',    value: `${estimatedSize} KB` },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {stats.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="glass-panel rounded-xl px-3 py-2.5 flex flex-col gap-1"
        >
          <Icon size={14} style={{ color: '#818cf8' }} />
          <p className="text-base font-semibold leading-tight" style={{ color: 'var(--newtab-text)' }}>
            {value}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--newtab-text-secondary)' }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Session Row / Card ─────────────────────────────────────────────────────────

interface SessionRowProps {
  session: Session;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRestore: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Session>) => Promise<void>;
  onExport: (id: string, name: string) => Promise<void>;
}

const SessionRow = memo(function SessionRow({
  session, selected, onToggleSelect, onRestore, onDelete, onUpdate, onExport,
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
    <div
      className="glass-panel rounded-xl px-4 py-3 flex items-start gap-3 group hover:bg-white/5 transition-colors"
      style={selected ? { outline: '1.5px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.08)' } : undefined}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => { e.stopPropagation(); onToggleSelect(session.id); }}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 w-3.5 h-3.5 shrink-0 rounded accent-indigo-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
        style={selected ? { opacity: 1 } : undefined}
        aria-label={`Select ${session.name}`}
      />

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
  const { sessions, loading, restoreSession, deleteSession, updateSession, refreshSessions } = useSession();
  const { sendMessage } = useMessaging();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [diffResult, setDiffResult] = useState<SessionDiffResponse | null>(null);
  const [diffSessions, setDiffSessions] = useState<[Session, Session] | null>(null);

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

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

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

  // ── Bulk actions ────────────────────────────────────────────────────────────

  const handleBulkExport = useCallback(async (ids: string[]) => {
    const res = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: ids, format: 'json' },
    });
    if (res.success && res.data) {
      const blob = new Blob([res.data as string], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'session-saver-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    clearSelection();
  }, [sendMessage, clearSelection]);

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    for (const id of ids) await deleteSession(id);
    clearSelection();
  }, [deleteSession, clearSelection]);

  const handleBulkMerge = useCallback(async (ids: string[]) => {
    const defaultName = `Merged Session — ${new Date().toLocaleDateString()}`;
    const name = window.prompt('Name for merged session:', defaultName) ?? defaultName;
    const res = await sendMessage<Session>({
      action: 'MERGE_SESSIONS',
      payload: { sessionIds: ids, targetName: name },
    });
    if (res.success) {
      clearSelection();
      await refreshSessions();
    }
  }, [sendMessage, clearSelection, refreshSessions]);

  const handleBulkCompare = useCallback(async (ids: [string, string]) => {
    const [idA, idB] = ids;
    const res = await sendMessage<SessionDiffResponse>({
      action: 'DIFF_SESSIONS',
      payload: { sessionIdA: idA, sessionIdB: idB },
    });
    if (res.success && res.data) {
      const sA = sessions.find((s) => s.id === idA)!;
      const sB = sessions.find((s) => s.id === idB)!;
      setDiffResult(res.data);
      setDiffSessions([sA, sB]);
    }
  }, [sendMessage, sessions]);

  // ── Virtualizer ─────────────────────────────────────────────────────────────

  const scrollRef = useRef<HTMLDivElement>(null);
  const COLS = 3;
  const CARD_H = 92;

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

      {/* Stats */}
      <SessionStatsBar sessions={sessions} />

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
              selected={selectedIds.has(session.id)}
              onToggleSelect={toggleSelect}
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
          style={{ height: 'calc(100vh - 340px)', overflowY: 'auto' }}
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
                  selected={selectedIds.has(sorted[vItem.index].id)}
                  onToggleSelect={toggleSelect}
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

      {/* Bulk toolbar — fixed bottom */}
      <SessionBulkToolbar
        selectedIds={selectedIds}
        onClear={clearSelection}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
        onMerge={handleBulkMerge}
        onCompare={handleBulkCompare}
      />

      {/* Diff modal */}
      {diffSessions && (
        <SessionDiffModal
          diffResult={diffResult}
          sessions={diffSessions}
          onClose={() => { setDiffSessions(null); setDiffResult(null); }}
        />
      )}
    </div>
  );
}
