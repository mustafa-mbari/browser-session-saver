import { useState } from 'react';
import { Search } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import { useSearch } from '@shared/hooks/useSearch';
import { useDashboardStore } from '../stores/dashboard.store';
import StatsWidget from '../components/StatsWidget';
import SessionDetail from '../components/SessionDetail';
import BulkToolbar from '../components/BulkToolbar';
import Modal from '@shared/components/Modal';
import { formatRelative } from '@core/utils/date';
import Badge from '@shared/components/Badge';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import type { Session } from '@core/types/session.types';
import type { SessionDiffResponse } from '@core/types/messages.types';

export default function SessionsPage() {
  const { sessions, loading, restoreSession, deleteSession, refreshSessions } = useSession();
  const { sendMessage } = useMessaging();
  const { filteredSessions, setQuery } = useSearch(sessions);
  const { selectedSessionIds, toggleSelection, clearSelection } = useDashboardStore();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<SessionDiffResponse | null>(null);
  const [diffSessions, setDiffSessions] = useState<[Session, Session] | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  const detailSession = sessions.find((s) => s.id === detailId);

  const handleMerge = async (ids: string[]) => {
    const defaultName = `Merged Session — ${new Date().toLocaleDateString()}`;
    const name = window.prompt('Name for merged session:', defaultName) ?? defaultName;
    const response = await sendMessage<Session>({
      action: 'MERGE_SESSIONS',
      payload: { sessionIds: ids, targetName: name },
    });
    if (response.success) {
      clearSelection();
      await refreshSessions();
    }
  };

  const handleCompare = async (ids: [string, string]) => {
    const [idA, idB] = ids;
    const response = await sendMessage<SessionDiffResponse>({
      action: 'DIFF_SESSIONS',
      payload: { sessionIdA: idA, sessionIdB: idB },
    });
    if (response.success && response.data) {
      const sA = sessions.find((s) => s.id === idA)!;
      const sB = sessions.find((s) => s.id === idB)!;
      setDiffResult(response.data);
      setDiffSessions([sA, sB]);
      setShowDiffModal(true);
    }
  };

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
                  className="rounded accent-primary"
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
              onDuplicate={async () => {
                const exportRes = await sendMessage<string>({
                  action: 'EXPORT_SESSIONS',
                  payload: { sessionIds: [detailSession.id], format: 'json' },
                });
                if (exportRes.success && exportRes.data) {
                  await sendMessage({
                    action: 'IMPORT_SESSIONS',
                    payload: { data: exportRes.data as string, source: 'json' },
                  });
                }
              }}
            />
          </div>
        )}
      </div>

      <BulkToolbar
        onDelete={async (ids) => {
          for (const id of ids) await deleteSession(id);
          clearSelection();
        }}
        onExport={async (ids) => {
          const response = await sendMessage<string>({
            action: 'EXPORT_SESSIONS',
            payload: { sessionIds: ids, format: 'json' },
          });
          if (response.success && response.data) {
            const blob = new Blob([response.data as string], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'session-saver-export.json';
            a.click();
            URL.revokeObjectURL(url);
          }
          clearSelection();
        }}
        onMerge={handleMerge}
        onCompare={handleCompare}
      />

      {/* Diff Modal */}
      <Modal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        title={diffSessions ? `Compare: ${diffSessions[0].name} vs ${diffSessions[1].name}` : 'Compare Sessions'}
      >
        {diffResult && (
          <div className="space-y-3 text-sm">
            {diffResult.added.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-success mb-1">+ Added ({diffResult.added.length})</p>
                <ul className="space-y-1">
                  {diffResult.added.map((tab) => (
                    <li key={tab.id} className="flex items-center gap-2 px-2 py-1 rounded bg-green-50 dark:bg-green-900/20">
                      {tab.favIconUrl && <img src={tab.favIconUrl} alt="" className="w-4 h-4 shrink-0" />}
                      <span className="truncate text-xs">{tab.title || tab.url}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diffResult.removed.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-error mb-1">− Removed ({diffResult.removed.length})</p>
                <ul className="space-y-1">
                  {diffResult.removed.map((tab) => (
                    <li key={tab.id} className="flex items-center gap-2 px-2 py-1 rounded bg-red-50 dark:bg-red-900/20">
                      {tab.favIconUrl && <img src={tab.favIconUrl} alt="" className="w-4 h-4 shrink-0" />}
                      <span className="truncate text-xs">{tab.title || tab.url}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diffResult.unchanged.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                  = Unchanged ({diffResult.unchanged.length})
                </p>
                <ul className="space-y-1 max-h-40 overflow-auto">
                  {diffResult.unchanged.map((tab) => (
                    <li key={tab.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--color-bg-secondary)]">
                      {tab.favIconUrl && <img src={tab.favIconUrl} alt="" className="w-4 h-4 shrink-0" />}
                      <span className="truncate text-xs text-[var(--color-text-secondary)]">{tab.title || tab.url}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diffResult.added.length === 0 && diffResult.removed.length === 0 && (
              <p className="text-[var(--color-text-secondary)] text-center py-4">Sessions are identical</p>
            )}
          </div>
        )}
        {!diffResult && <p className="text-[var(--color-text-secondary)]">Loading diff...</p>}
      </Modal>
    </div>
  );
}
