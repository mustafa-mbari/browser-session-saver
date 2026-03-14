import { RotateCcw, Trash2, Download, Copy, ExternalLink } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import { formatTimestamp } from '@core/utils/date';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';

interface SessionDetailProps {
  session: Session;
  onRestore: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function SessionDetail({ session, onRestore, onDelete, onDuplicate }: SessionDetailProps) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">{session.name}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {formatTimestamp(session.createdAt)}
          </p>
          <div className="flex gap-1.5 mt-2">
            <Badge>{session.tabCount} tabs</Badge>
            <Badge>{session.tabGroups.length} groups</Badge>
            {session.isAutoSave && <Badge variant="primary">Auto-save</Badge>}
            {session.isPinned && <Badge variant="success">Pinned</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button icon={RotateCcw} size="sm" onClick={onRestore}>
            Restore
          </Button>
          <Button icon={Copy} variant="secondary" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button icon={Download} variant="secondary" size="sm">
            Export
          </Button>
          <Button icon={Trash2} variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {session.tags.length > 0 && (
        <div className="flex gap-1 mb-4">
          {session.tags.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
        </div>
      )}

      {session.notes && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-4 italic">{session.notes}</p>
      )}

      <div className="border-t border-[var(--color-border)] pt-4">
        <h3 className="text-sm font-semibold mb-3">Tabs</h3>

        {session.tabGroups.map((group) => {
          const groupTabs = session.tabs.filter((t) => t.groupId === group.id);
          if (groupTabs.length === 0) return null;
          return (
            <div key={group.id} className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: `var(--group-${group.color})` }}
                />
                <span className="text-sm font-medium">{group.title || 'Unnamed group'}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{groupTabs.length}</span>
              </div>
              {groupTabs.map((tab) => (
                <TabItem key={tab.id} title={tab.title} url={tab.url} favIconUrl={tab.favIconUrl} />
              ))}
            </div>
          );
        })}

        {session.tabs.filter((t) => t.groupId === -1).map((tab) => (
          <TabItem key={tab.id} title={tab.title} url={tab.url} favIconUrl={tab.favIconUrl} />
        ))}
      </div>
    </div>
  );
}

function TabItem({ title, url, favIconUrl }: { title: string; url: string; favIconUrl: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[var(--color-bg-secondary)] transition-colors group">
      {favIconUrl ? (
        <img src={favIconUrl} alt="" className="w-4 h-4 rounded-sm" />
      ) : (
        <div className="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-600" />
      )}
      <span className="text-sm truncate flex-1">{title || url}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ExternalLink size={12} className="text-[var(--color-text-secondary)]" />
      </a>
    </div>
  );
}
