import { useState, useEffect } from 'react';
import { RotateCcw, Trash2, Download, ExternalLink, Edit2, Check } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import { formatTimestamp } from '@core/utils/date';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import TabGroupPreview from '../components/TabGroupPreview';

export default function SessionDetailView() {
  const { selectedSessionId, goBack } = useSidePanelStore();
  const { restoreSession, deleteSession, updateSession } = useSession();
  const { sendMessage } = useMessaging();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    if (!selectedSessionId) return;

    const fetchSession = async () => {
      setLoading(true);
      const response = await sendMessage<Session[]>({
        action: 'GET_SESSIONS',
        payload: {},
      });
      if (response.success && response.data) {
        const found = response.data.find((s) => s.id === selectedSessionId);
        setSession(found ?? null);
        if (found) setNameInput(found.name);
      }
      setLoading(false);
    };

    fetchSession();
  }, [selectedSessionId, sendMessage]);

  if (loading) return <LoadingSpinner />;
  if (!session) return <div className="p-4 text-center text-[var(--color-text-secondary)]">Session not found</div>;

  const handleSaveName = async () => {
    if (nameInput.trim() && nameInput !== session.name) {
      await updateSession(session.id, { name: nameInput.trim() });
      setSession({ ...session, name: nameInput.trim() });
    }
    setEditingName(false);
  };

  const handleRestore = async () => {
    await restoreSession(session.id, 'new_window');
  };

  const handleDelete = async () => {
    await deleteSession(session.id);
    goBack();
  };

  const groupedTabs = session.tabGroups.map((group) => ({
    group,
    tabs: session.tabs.filter((t) => t.groupId === group.id),
  }));
  const ungroupedTabs = session.tabs.filter((t) => t.groupId === -1);

  return (
    <div className="flex flex-col h-full">
      {/* Session Header */}
      <div className="px-3 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {editingName ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
              />
              <button onClick={handleSaveName} className="p-1 text-success">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-sm flex-1 truncate">{session.name}</h2>
              <button
                onClick={() => setEditingName(true)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Edit name"
              >
                <Edit2 size={14} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {formatTimestamp(session.createdAt)}
          </span>
          <Badge>{session.tabCount} tabs</Badge>
          {session.isAutoSave && <Badge variant="primary">Auto</Badge>}
        </div>
        {session.tabGroups.length > 0 && (
          <div className="mt-1.5">
            <TabGroupPreview groups={session.tabGroups} maxVisible={10} />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-3 py-2 flex gap-2 border-b border-[var(--color-border)]">
        <Button icon={RotateCcw} size="sm" className="flex-1" onClick={handleRestore}>
          Restore
        </Button>
        <Button icon={Download} variant="secondary" size="sm">
          Export
        </Button>
        <Button icon={Trash2} variant="danger" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      {/* Tab List */}
      <div className="flex-1 overflow-auto">
        {groupedTabs.map(({ group, tabs }) => (
          <div key={group.id}>
            <div className="px-3 py-1.5 bg-[var(--color-bg-secondary)] flex items-center gap-2 sticky top-0">
              <span
                className={`w-2 h-2 rounded-full`}
                style={{ backgroundColor: `var(--group-${group.color})` }}
              />
              <span className="text-xs font-medium">{group.title || 'Unnamed group'}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{tabs.length}</span>
            </div>
            {tabs.map((tab) => (
              <TabRow key={tab.id} url={tab.url} title={tab.title} favIconUrl={tab.favIconUrl} />
            ))}
          </div>
        ))}

        {ungroupedTabs.length > 0 && (
          <>
            {groupedTabs.length > 0 && (
              <div className="px-3 py-1.5 bg-[var(--color-bg-secondary)] text-xs font-medium sticky top-0">
                Ungrouped
              </div>
            )}
            {ungroupedTabs.map((tab) => (
              <TabRow key={tab.id} url={tab.url} title={tab.title} favIconUrl={tab.favIconUrl} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TabRow({ url, title, favIconUrl }: { url: string; title: string; favIconUrl: string }) {
  return (
    <div className="px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--color-bg-secondary)] transition-colors group">
      {favIconUrl ? (
        <img src={favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-600 shrink-0" />
      )}
      <span className="text-sm truncate flex-1" title={title}>
        {title || url}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
        aria-label={`Open ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink size={12} className="text-[var(--color-text-secondary)]" />
      </a>
    </div>
  );
}
