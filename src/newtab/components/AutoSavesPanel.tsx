import { useMemo, useRef } from 'react';
import { Clock, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSession } from '@shared/hooks/useSession';
import { formatRelative } from '@core/utils/date';
import Badge from '@shared/components/Badge';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import type { Session } from '@core/types/session.types';

interface AutoSaveRowProps {
  session: Session;
  triggerLabel: string;
  onRestore: (id: string, mode: 'new_window') => void;
  onDelete: (id: string) => void;
}

function AutoSaveRow({ session, triggerLabel, onRestore, onDelete }: AutoSaveRowProps) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 group">
      <RefreshCw size={14} className="shrink-0 opacity-40" style={{ color: 'var(--newtab-text)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--newtab-text)' }}>
          {session.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
          {formatRelative(session.createdAt)} · {session.tabCount} tabs
        </p>
      </div>
      <Badge variant="primary">{triggerLabel}</Badge>
      <span
        className="text-xs px-2 py-0.5 rounded-full shrink-0"
        style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--newtab-text-secondary)' }}
      >
        {session.tabCount} tabs
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => { void onRestore(session.id, 'new_window'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--newtab-text)' }}
        >
          <RotateCcw size={11} />
          Restore
        </button>
        <button
          onClick={() => { void onDelete(session.id); }}
          className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:bg-red-500/20"
          style={{ color: 'rgba(255,100,100,0.8)' }}
          aria-label="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function AutoSavesPanel() {
  const { sessions, loading, restoreSession, deleteSession } = useSession();

  const autoSaves = useMemo(
    () =>
      sessions
        .filter((s) => s.isAutoSave)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sessions],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof autoSaves>();
    for (const session of autoSaves) {
      const dateKey = new Date(session.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(session);
    }
    return Array.from(groups.entries());
  }, [autoSaves]);

  type FlatItem =
    | { type: 'header'; date: string }
    | { type: 'session'; session: (typeof autoSaves)[number] };

  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];
    for (const [date, sessions] of grouped) {
      items.push({ type: 'header', date });
      for (const s of sessions) items.push({ type: 'session', session: s });
    }
    return items;
  }, [grouped]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (flatItems[i]?.type === 'header' ? 32 : 64),
    overscan: 5,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="pt-4 flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
          Auto-Saves
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--newtab-text-secondary)' }}>
            {autoSaves.length} auto-save{autoSaves.length !== 1 ? 's' : ''}
          </span>
          {autoSaves.length > 0 && (
            <button
              onClick={async () => {
                const old = autoSaves.filter((s) => {
                  return Date.now() - new Date(s.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000;
                });
                for (const s of old) await deleteSession(s.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors"
              style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--newtab-text-secondary)' }}
            >
              <Trash2 size={12} />
              Purge 7d+
            </button>
          )}
        </div>
      </div>

      {autoSaves.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-xl" style={{ color: 'var(--newtab-text-secondary)' }}>
          <Clock size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-base">No auto-saves yet</p>
          <p className="text-sm mt-1 opacity-60">
            Auto-saves appear when triggered by browser close, sleep, low battery, or timer
          </p>
        </div>
      ) : autoSaves.length <= 30 ? (
        /* Small list — standard grouped render */
        <div className="flex flex-col gap-5">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.7 }}>
                {date}
              </p>
              <div className="flex flex-col gap-2">
                {items.map((session) => {
                  const triggerLabel =
                    session.autoSaveTrigger.charAt(0).toUpperCase() +
                    session.autoSaveTrigger.slice(1).replace(/_/g, ' ');
                  return (
                    <AutoSaveRow
                      key={session.id}
                      session={session}
                      triggerLabel={triggerLabel}
                      onRestore={restoreSession}
                      onDelete={deleteSession}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Large list — virtualised flat list with date headers */
        <div
          ref={scrollRef}
          style={{ height: 'calc(100vh - 210px)', overflowY: 'auto' }}
        >
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const item = flatItems[vItem.index];
              return (
                <div
                  key={vItem.key}
                  style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: vItem.size }}
                >
                  {item.type === 'header' ? (
                    <p
                      className="text-xs font-semibold px-1 pt-3 pb-1"
                      style={{ color: 'var(--newtab-text-secondary)', opacity: 0.7 }}
                    >
                      {item.date}
                    </p>
                  ) : (
                    <div style={{ paddingBottom: 8 }}>
                      <AutoSaveRow
                        session={item.session}
                        triggerLabel={
                          item.session.autoSaveTrigger.charAt(0).toUpperCase() +
                          item.session.autoSaveTrigger.slice(1).replace(/_/g, ' ')
                        }
                        onRestore={restoreSession}
                        onDelete={deleteSession}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
