import { useState } from 'react';
import { Search, RotateCcw, Trash2 } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useSearch } from '@shared/hooks/useSearch';
import { useDashboardStore } from '../stores/dashboard.store';
import StatsWidget from '../components/StatsWidget';
import SessionDetail from '../components/SessionDetail';
import BulkToolbar from '../components/BulkToolbar';
import { formatRelative } from '@core/utils/date';
import Badge from '@shared/components/Badge';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function SessionsPage() {
  const { sessions, loading, restoreSession, deleteSession, updateSession } = useSession();
  const { filteredSessions, setQuery } = useSearch(sessions);
  const { selectedSessionIds, toggleSelection, isSelectionMode } = useDashboardStore();
  const [detailId, setDetailId] = useState<string | null>(null);

  const detailSession = sessions.find((s) => s.id === detailId);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Sessions</h2>

      <StatsWidget sessions={sessions} />

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
        />
        <input
          type="text"
          placeholder="Search sessions..."
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-btn bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex gap-6">
        {/* Session List */}
        <div className="flex-1">
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] cursor-pointer transition-colors ${
                  detailId === session.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => setDetailId(session.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedSessionIds.has(session.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelection(session.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {formatRelative(session.createdAt)} · {session.tabCount} tabs
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {session.isAutoSave && <Badge variant="primary">Auto</Badge>}
                  {session.isPinned && <Badge variant="success">Pinned</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {detailSession && (
          <div className="w-[400px] rounded-card border border-[var(--color-border)] overflow-auto max-h-[calc(100vh-200px)]">
            <SessionDetail
              session={detailSession}
              onRestore={() => restoreSession(detailSession.id)}
              onDelete={async () => {
                await deleteSession(detailSession.id);
                setDetailId(null);
              }}
              onDuplicate={() => {}}
            />
          </div>
        )}
      </div>

      <BulkToolbar
        onDelete={async (ids) => {
          for (const id of ids) await deleteSession(id);
        }}
        onExport={() => {}}
      />
    </div>
  );
}
