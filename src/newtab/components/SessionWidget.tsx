import { useSession } from '@shared/hooks/useSession';
import Badge from '@shared/components/Badge';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import { formatRelative } from '@core/utils/date';

export default function SessionWidget() {
  const { sessions, loading, restoreSession } = useSession();

  const recent = [...sessions]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-semibold text-sm" style={{ color: 'var(--newtab-text)' }}>
        Recent Sessions
      </h3>

      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : recent.length === 0 ? (
        <p className="text-sm opacity-50 py-2" style={{ color: 'var(--newtab-text)' }}>
          No saved sessions yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {recent.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--newtab-text)' }}>
                  {session.name}
                </div>
                <div className="text-xs opacity-60" style={{ color: 'var(--newtab-text)' }}>
                  {formatRelative(session.updatedAt)}
                </div>
              </div>
              <Badge variant="default">{session.tabCount}</Badge>
              <button
                onClick={() => void restoreSession(session.id, 'new_window')}
                className="glass text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                style={{ color: 'var(--newtab-text)' }}
                aria-label={`Restore session ${session.name}`}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
