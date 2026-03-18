import { useState, useEffect } from 'react';
import { Save, X, ExternalLink, RotateCcw, PanelRight } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import type { CurrentTabsResponse } from '@core/types/messages.types';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import { useTheme } from '@shared/hooks/useTheme';
import { formatRelative } from '@core/utils/date';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';

export default function App() {
  useTheme();
  const { sessions, saveSession, restoreSession } = useSession();
  const { sendMessage } = useMessaging();
  const [saving, setSaving] = useState(false);
  const [tabInfo, setTabInfo] = useState<CurrentTabsResponse | null>(null);

  useEffect(() => {
    sendMessage<CurrentTabsResponse>({
      action: 'GET_CURRENT_TABS',
      payload: {},
    }).then((r) => {
      if (r.success && r.data) setTabInfo(r.data);
    });
  }, [sendMessage]);

  const handleSave = async (closeAfter = false) => {
    setSaving(true);
    await saveSession({ closeAfter });
    setSaving(false);
  };

  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="w-[340px] bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-base">Browser Hub</h1>
          {tabInfo && (
            <Badge>
              {tabInfo.tabCount} tab{tabInfo.tabCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 space-y-2">
        <Button icon={Save} fullWidth loading={saving} onClick={() => handleSave(false)}>
          Save Session
        </Button>
        <Button
          icon={X}
          variant="secondary"
          fullWidth
          size="sm"
          onClick={() => handleSave(true)}
        >
          Save & Close Tabs
        </Button>
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div className="border-t border-[var(--color-border)]">
          <div className="px-4 py-2">
            <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
              Recent
            </h2>
          </div>
          {recentSessions.map((session) => (
            <PopupSessionItem
              key={session.id}
              session={session}
              onRestore={() => restoreSession(session.id)}
            />
          ))}
        </div>
      )}

      {/* Footer Links */}
      <div className="px-4 py-2 border-t border-[var(--color-border)] flex justify-between">
        <button
          onClick={async () => {
            const wid = tabInfo?.windowId ?? (await chrome.windows.getCurrent()).id;
            if (wid) chrome.sidePanel.open({ windowId: wid });
            window.close();
          }}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <PanelRight size={12} />
          Open Side Panel
        </button>
        <button
          onClick={() => {
            chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html') + '?view=sessions' });
            window.close();
          }}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink size={12} />
          Session Manager
        </button>
      </div>
    </div>
  );
}

function PopupSessionItem({
  session,
  onRestore,
}: {
  session: Session;
  onRestore: () => void;
}) {
  return (
    <div className="px-4 py-2 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{session.name}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {formatRelative(session.createdAt)} · {session.tabCount} tabs
        </p>
      </div>
      <button
        onClick={onRestore}
        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-primary transition-colors shrink-0"
        aria-label={`Restore ${session.name}`}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
