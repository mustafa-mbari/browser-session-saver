import { useMemo } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { formatRelative } from '@core/utils/date';
import Badge from '@shared/components/Badge';
import Button from '@shared/components/Button';
import EmptyState from '@shared/components/EmptyState';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function AutoSavesPage() {
  const { sessions, loading, deleteSession, restoreSession } = useSession();

  const autoSaves = useMemo(
    () => sessions.filter((s) => s.isAutoSave).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
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

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Auto-Saves</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {autoSaves.length} auto-save{autoSaves.length !== 1 ? 's' : ''}
          </p>
        </div>
        {autoSaves.length > 0 && (
          <Button
            icon={Trash2}
            variant="secondary"
            size="sm"
            onClick={async () => {
              const old = autoSaves.filter((s) => {
                const age = Date.now() - new Date(s.createdAt).getTime();
                return age > 7 * 24 * 60 * 60 * 1000; // older than 7 days
              });
              for (const s of old) await deleteSession(s.id);
            }}
          >
            Purge Old (7d+)
          </Button>
        )}
      </div>

      {autoSaves.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No auto-saves yet"
          description="Auto-saves will appear here when triggered by browser close, sleep, low battery, or periodic timer."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">{date}</h3>
              <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
                {items.map((session) => {
                  const triggerLabel =
                    session.autoSaveTrigger.charAt(0).toUpperCase() +
                    session.autoSaveTrigger.slice(1).replace('_', ' ');
                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
                      <Clock size={16} className="text-[var(--color-text-secondary)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {formatRelative(session.createdAt)} · {session.tabCount} tabs
                        </p>
                      </div>
                      <Badge variant="primary">{triggerLabel}</Badge>
                      <button
                        onClick={() => restoreSession(session.id)}
                        className="px-2 py-1 text-xs font-medium text-primary hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="px-2 py-1 text-xs font-medium text-error hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
