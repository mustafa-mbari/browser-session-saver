import { useState, useMemo } from 'react';
import { Search, RotateCcw, Trash2 } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { formatRelative } from '@core/utils/date';
import Badge from '@shared/components/Badge';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function SessionsPanel() {
  const { sessions, loading, restoreSession, deleteSession } = useSession();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.name.toLowerCase().includes(q) || s.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [sessions, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="pt-4 flex flex-col gap-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
          All Sessions
        </h2>
        <span className="text-sm" style={{ color: 'var(--newtab-text-secondary)' }}>
          {sessions.length} saved
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--newtab-text-secondary)' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions..."
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none glass"
          style={{ color: 'var(--newtab-text)', background: 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--newtab-text-secondary)' }}>
          <p className="text-base">{query ? 'No sessions match your search' : 'No saved sessions yet'}</p>
          <p className="text-sm mt-1 opacity-70">
            {!query && 'Save a session from the side panel to see it here'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((session) => (
            <div
              key={session.id}
              className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--newtab-text)' }}
                >
                  {session.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
                  {formatRelative(session.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {session.isAutoSave && <Badge variant="primary">Auto</Badge>}
                {session.isPinned && <Badge variant="success">Pinned</Badge>}
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: 'var(--newtab-text-secondary)',
                  }}
                >
                  {session.tabCount} tabs
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { void restoreSession(session.id, 'new_window'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/20"
                  style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--newtab-text)' }}
                  title="Restore in new window"
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
                <button
                  onClick={() => { void deleteSession(session.id); }}
                  className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:bg-red-500/20"
                  style={{ color: 'rgba(255,100,100,0.8)' }}
                  title="Delete session"
                  aria-label="Delete session"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
