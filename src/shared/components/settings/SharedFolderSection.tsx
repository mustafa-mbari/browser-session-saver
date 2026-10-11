import { useEffect, useState, type ReactNode } from 'react';
import { FolderSync, RefreshCw, Trash2 } from 'lucide-react';
import { formatRelative } from '@core/utils/date';
import {
  getBrowserInstance,
  renameBrowserInstance,
  type BrowserInstance,
} from '@core/services/browser-instance.service';
import {
  connectFolder,
  getPreShareBackupDate,
  isFolderAccessSupported,
  reconnectFolder,
  removePeer,
  restorePreShareBackup,
  setSharedModules,
  stopSharing,
  syncNow,
  type SyncOutcome,
} from '@core/sync/shared-folder/shared-folder.service';
import type { BackupModule } from '@core/types/import-export.types';
import { useSharedFolderState } from '@shared/hooks/useSharedFolder';
import { GlassSectionTitle, GlassToggle } from './glass-controls';
import { PanelSection, PanelToggle } from './panel-controls';

const MODULE_LABELS: { module: BackupModule; label: string; description?: string }[] = [
  { module: 'sessions', label: 'Sessions' },
  { module: 'prompts', label: 'Prompts' },
  { module: 'subscriptions', label: 'Subscriptions' },
  { module: 'tabGroupTemplates', label: 'Saved tab groups' },
  { module: 'dashboard', label: 'Start tab', description: 'Boards, bookmarks, notes, to-dos and quick links' },
  { module: 'settings', label: 'Settings', description: 'The wallpaper stays per browser' },
];

const STYLES = {
  sidepanel: {
    group: (title: string, rows: ReactNode) => <PanelSection title={title}>{rows}</PanelSection>,
    Toggle: PanelToggle,
    text: 'text-sm text-(--color-text)',
    muted: 'text-[11px] leading-snug text-(--color-text-secondary)',
    primary: 'px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50',
    secondary:
      'px-3 py-1.5 text-sm rounded-md border border-(--color-border) text-(--color-text) hover:bg-(--color-bg-secondary) disabled:opacity-50',
    link: 'text-sm text-primary hover:underline disabled:opacity-50 text-left',
    input:
      'w-full px-2 py-1 text-sm rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) focus:outline-hidden focus:ring-1 focus:ring-primary',
    row: 'flex items-center justify-between gap-2 py-1 border-b border-(--color-border) last:border-b-0',
    error: 'text-[11px] leading-snug text-red-600 dark:text-red-400',
  },
  newtab: {
    group: (title: string, rows: ReactNode) => (
      <div>
        <GlassSectionTitle>{title}</GlassSectionTitle>
        <div className="flex flex-col gap-2">{rows}</div>
      </div>
    ),
    Toggle: GlassToggle,
    text: 'text-sm text-(--newtab-text)',
    muted: 'text-xs leading-snug text-white/45',
    primary: 'px-3 py-1.5 text-sm rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50',
    secondary:
      'px-3 py-1.5 text-sm rounded-lg border border-white/15 bg-white/5 text-(--newtab-text) hover:bg-white/10 disabled:opacity-50',
    link: 'text-sm text-indigo-300 hover:underline disabled:opacity-50 text-left',
    input:
      'w-full px-2 py-1.5 text-sm rounded-lg border border-white/12 bg-white/8 text-(--newtab-text) outline-hidden focus:border-indigo-400/60',
    row: 'flex items-center justify-between gap-2 py-1 border-b border-white/8 last:border-b-0',
    error: 'text-xs leading-snug text-red-300',
  },
} as const;

interface Props {
  variant: keyof typeof STYLES;
  /** Wraps the section's rows. Defaults to the variant's standard group container. */
  renderGroup?: (title: string, rows: ReactNode) => ReactNode;
}

function isCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Share one data set between the browsers on this computer through a folder. */
export default function SharedFolderSection({ variant, renderGroup }: Props) {
  const s = STYLES[variant];
  const { Toggle } = s;
  const state = useSharedFolderState();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [instance, setInstance] = useState<BrowserInstance | null>(null);
  const [backupDate, setBackupDate] = useState<string | null>(null);

  useEffect(() => {
    void getBrowserInstance().then(setInstance);
  }, []);

  useEffect(() => {
    if (state.enabled) void getPreShareBackupDate().then(setBackupDate);
  }, [state.enabled, state.joinedAt]);

  const run = async (action: () => Promise<SyncOutcome | unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      const outcome = (await action()) as SyncOutcome | undefined;
      if (outcome && typeof outcome === 'object' && outcome.status === 'error') setProblem(outcome.error);
    } catch (error) {
      if (!isCancel(error)) setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const rename = async (label: string) => {
    if (!instance || !label.trim() || label.trim() === instance.label) return;
    setInstance(await renameBrowserInstance(label));
    if (state.enabled) void syncNow();
  };

  let rows: ReactNode;
  if (!state.enabled) {
    rows = (
      <>
        <p className={s.muted}>
          Use the same sessions, prompts, bookmarks and settings in every browser on this computer.
          Choose a folder here (for example Documents › Browser Hub), then choose the same folder in each of
          your other browsers. Your data stays on this computer; a folder inside OneDrive or Dropbox also
          shares it between computers.
        </p>
        {isFolderAccessSupported() ? (
          <button className={`${s.primary} self-start`} disabled={busy} onClick={() => void run(connectFolder)}>
            <span className="inline-flex items-center gap-1.5">
              <FolderSync size={14} /> Choose folder…
            </span>
          </button>
        ) : (
          <p className={s.muted}>
            This browser does not let extensions use folders. In Brave, turn on
            brave://flags/#file-system-access-api and restart the browser.
          </p>
        )}
      </>
    );
  } else {
    const otherBrowsers = state.peers;
    rows = (
      <>
        <div>
          <p className={s.text}>
            Folder: <strong>{state.folderName ?? 'unknown'}</strong>
          </p>
          {state.status === 'ok' && (
            <p className={s.muted}>
              {state.lastSyncAt ? `Up to date · synced ${formatRelative(state.lastSyncAt)}` : 'Waiting for the first sync'}
            </p>
          )}
          {state.status === 'needs-permission' && (
            <p className={s.muted}>The browser needs your permission to use the folder again.</p>
          )}
          {state.status === 'error' && <p className={s.error}>Sync problem: {state.lastError}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {state.status === 'needs-permission' ? (
            <button className={s.primary} disabled={busy} onClick={() => void run(reconnectFolder)}>
              Reconnect
            </button>
          ) : (
            <button
              className={s.secondary}
              disabled={busy}
              onClick={() => void run(() => syncNow({ interactive: true }))}
            >
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Sync now
              </span>
            </button>
          )}
          <button
            className={s.secondary}
            disabled={busy}
            onClick={() => {
              if (window.confirm('Stop sharing? This browser keeps its data; it is removed from the shared folder.')) {
                void run(stopSharing);
              }
            }}
          >
            Stop sharing
          </button>
        </div>

        <label className="block">
          <span className={s.muted}>This browser is called</span>
          <input
            key={instance?.label}
            className={s.input}
            defaultValue={instance?.label ?? ''}
            onBlur={(e) => void rename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            aria-label="Name of this browser"
          />
        </label>

        <div>
          <p className={s.muted}>Other browsers using this folder</p>
          {otherBrowsers.length === 0 ? (
            <p className={s.muted}>None yet — choose this folder in your other browsers.</p>
          ) : (
            otherBrowsers.map((peer) => (
              <div key={peer.fileName} className={s.row}>
                <div className="min-w-0">
                  <p className={`${s.text} truncate`}>{peer.label}</p>
                  <p className={s.muted}>
                    Updated {formatRelative(peer.writtenAt)}
                    {peer.stale ? ' · inactive, not merged' : ''}
                  </p>
                </div>
                <button
                  className={s.link}
                  disabled={busy}
                  aria-label={`Remove ${peer.label} from the shared folder`}
                  onClick={() => {
                    const ok = window.confirm(
                      `Remove ${peer.label}'s file from the shared folder? Its data stays in the browsers that already merged it.`,
                    );
                    if (ok) void run(() => removePeer(peer.fileName));
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div>
          <p className={s.muted}>What to share</p>
          {MODULE_LABELS.map(({ module, label, description }) => (
            <Toggle
              key={module}
              label={label}
              description={description}
              checked={state.modules[module]}
              onChange={(v) => {
                void setSharedModules({ ...state.modules, [module]: v }).then(() => syncNow());
              }}
            />
          ))}
        </div>

        {backupDate && (
          <button
            className={s.link}
            disabled={busy}
            onClick={() => {
              const ok = window.confirm(
                `Stop sharing and put back this browser's data from ${new Date(backupDate).toLocaleString()} (before it joined the folder)? Current data in this browser is replaced.`,
              );
              if (ok) void run(restorePreShareBackup);
            }}
          >
            Restore data from before sharing
          </button>
        )}
      </>
    );
  }

  const wrap = renderGroup ?? s.group;
  return (
    <>
      {wrap(
        'Share across browsers',
        <>
          {rows}
          {problem && <p className={s.error}>{problem}</p>}
        </>,
      )}
    </>
  );
}
