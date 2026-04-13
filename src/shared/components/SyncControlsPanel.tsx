import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { SelectiveSyncSettings } from '@core/sync/state/selective-sync-settings';
import type { MassDeleteTrip } from '@core/sync/state/mass-delete-guard';
import type { SyncEntityKey } from '@core/sync/types/syncable';

type DirtyCounts = Record<SyncEntityKey, { dirty: number; tombstones: number }>;

interface Props {
  /** 'sidepanel' uses `--color-*`, 'newtab' uses `--newtab-*` glassmorphism tokens. */
  themeVariant?: 'sidepanel' | 'newtab';
  /** Called whenever settings change so the parent can refresh its status. */
  onChange?: () => void;
}

const ENTITY_LABELS: Record<SyncEntityKey, string> = {
  sessions: 'Sessions',
  prompts: 'Prompts',
  prompt_folders: 'Prompt folders',
  subscriptions: 'Subscriptions',
  tab_group_templates: 'Tab group templates',
  bookmark_folders: 'Bookmark folders',
  bookmark_entries: 'Bookmark entries',
  todo_lists: 'Todo lists',
  todo_items: 'Todo items',
  quick_links: 'Quick links',
};

const ALL_ENTITIES: SyncEntityKey[] = [
  'sessions',
  'prompts',
  'prompt_folders',
  'subscriptions',
  'tab_group_templates',
  'bookmark_folders',
  'bookmark_entries',
  'todo_lists',
  'todo_items',
  'quick_links',
];

export default function SyncControlsPanel({ themeVariant = 'sidepanel', onChange }: Props) {
  const { sendMessage } = useMessaging();
  const [settings, setSettings] = useState<SelectiveSyncSettings | null>(null);
  const [dirty, setDirty] = useState<DirtyCounts | null>(null);
  const [trips, setTrips] = useState<MassDeleteTrip[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  const text = themeVariant === 'newtab' ? 'var(--newtab-text)' : 'var(--color-text)';
  const textSecondary =
    themeVariant === 'newtab' ? 'var(--newtab-text-secondary)' : 'var(--color-text-secondary)';
  const border = themeVariant === 'newtab' ? 'rgba(255,255,255,0.12)' : 'var(--color-border)';
  const bgSecondary =
    themeVariant === 'newtab' ? 'rgba(255,255,255,0.06)' : 'var(--color-bg-secondary)';
  const bgHover =
    themeVariant === 'newtab' ? 'rgba(255,255,255,0.1)' : 'var(--color-bg-hover)';

  const reload = useCallback(async () => {
    const [s, d, t] = await Promise.all([
      sendMessage<SelectiveSyncSettings>({ action: 'SYNC_GET_SETTINGS', payload: {} }),
      sendMessage<DirtyCounts>({ action: 'SYNC_GET_DIRTY_COUNTS', payload: {} }),
      sendMessage<MassDeleteTrip[]>({ action: 'SYNC_GET_MASS_DELETE_TRIPS', payload: {} }),
    ]);
    if (s.success && s.data) setSettings(s.data);
    if (d.success && d.data) setDirty(d.data);
    if (t.success && t.data) setTrips(t.data);
  }, [sendMessage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Re-render once per second while a pause countdown is active so the
  // "Resumes in 42m" label stays fresh.
  useEffect(() => {
    if (!settings?.pauseUntil) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [settings?.pauseUntil]);

  const updateSettings = useCallback(
    async (patch: {
      syncEnabled?: boolean;
      entities?: Partial<Record<SyncEntityKey, boolean>>;
    }) => {
      const res = await sendMessage<SelectiveSyncSettings>({
        action: 'SYNC_UPDATE_SETTINGS',
        payload: patch,
      });
      if (res.success && res.data) {
        setSettings(res.data);
        onChange?.();
      }
    },
    [sendMessage, onChange],
  );

  const handlePause = async (minutes: number) => {
    const res = await sendMessage<SelectiveSyncSettings>({
      action: 'SYNC_PAUSE',
      payload: { minutes, reason: 'user-requested' },
    });
    if (res.success && res.data) {
      setSettings(res.data);
      onChange?.();
    }
  };

  const handleResume = async () => {
    const res = await sendMessage<SelectiveSyncSettings>({
      action: 'SYNC_CLEAR_PAUSE',
      payload: {},
    });
    if (res.success && res.data) {
      setSettings(res.data);
      onChange?.();
    }
  };

  const handleConfirmMassDelete = async (entity: SyncEntityKey) => {
    // Acknowledge the trip and lift the pause so the next cycle will push.
    await sendMessage({ action: 'SYNC_CLEAR_MASS_DELETE_TRIP', payload: { entity } });
    await sendMessage({ action: 'SYNC_CLEAR_PAUSE', payload: {} });
    await reload();
    onChange?.();
  };

  const handleCancelMassDelete = async () => {
    // User wants to restore — keep trips cleared but also pause for another
    // hour so nothing pushes while they sort it out with Restore from Cloud.
    await sendMessage({ action: 'SYNC_CLEAR_ALL_MASS_DELETE_TRIPS', payload: {} });
    await sendMessage({ action: 'SYNC_PAUSE', payload: { minutes: 60, reason: 'user-restoring' } });
    await reload();
    onChange?.();
  };

  if (!settings) {
    return (
      <div className="text-xs" style={{ color: textSecondary }}>
        Loading sync controls…
      </div>
    );
  }

  const pauseMs = settings.pauseUntil ? Date.parse(settings.pauseUntil) - now : 0;
  const isPaused = pauseMs > 0;
  const pauseLabel = (() => {
    if (!isPaused) return null;
    const mins = Math.ceil(pauseMs / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
  })();

  return (
    <div className="space-y-4">
      {/* ─── Mass-delete confirmation banner ────────────────────────────── */}
      {trips.length > 0 && (
        <div
          className="rounded-xl border p-3 space-y-2"
          style={{
            borderColor: 'rgba(220, 38, 38, 0.4)',
            background: 'rgba(220, 38, 38, 0.08)',
          }}
        >
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                Unusual deletion activity detected
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
                Sync is paused. Review the pending deletes below and confirm, or cancel and restore
                from the cloud.
              </p>
            </div>
          </div>
          <ul className="space-y-1 pl-6">
            {trips.map((trip) => (
              <li
                key={trip.entity}
                className="flex items-center justify-between gap-2 text-[11px]"
                style={{ color: text }}
              >
                <span>
                  <strong>{ENTITY_LABELS[trip.entity] ?? trip.entity}</strong>:{' '}
                  {trip.tombstoneCount} of {trip.totalCount} marked for deletion (threshold{' '}
                  {trip.threshold})
                </span>
                <button
                  onClick={() => handleConfirmMassDelete(trip.entity)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Confirm
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleCancelMassDelete}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors"
              style={{ borderColor: border, color: text }}
            >
              <RotateCcw size={11} />
              Cancel & restore
            </button>
          </div>
        </div>
      )}

      {/* ─── Pause status + quick-action ────────────────────────────────── */}
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: border, background: bgSecondary }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isPaused ? (
              <Pause size={14} className="text-amber-500 shrink-0" />
            ) : (
              <Play size={14} className="text-green-500 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold" style={{ color: text }}>
                {isPaused ? 'Sync paused' : 'Sync active'}
              </p>
              {isPaused && pauseLabel && (
                <p className="text-[10px]" style={{ color: textSecondary }}>
                  Resumes in {pauseLabel}
                  {settings.pauseReason ? ` · ${settings.pauseReason}` : ''}
                </p>
              )}
            </div>
          </div>
          {isPaused && (
            <button
              onClick={handleResume}
              className="text-[11px] font-medium px-2 py-1 rounded-md border transition-colors"
              style={{ borderColor: border, color: text }}
            >
              Resume
            </button>
          )}
        </div>
        {!isPaused && (
          <div className="flex gap-2">
            <button
              onClick={() => handlePause(60)}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-md border transition-colors hover:opacity-80"
              style={{ borderColor: border, color: text, background: bgHover }}
            >
              <Clock size={11} /> Pause 1h
            </button>
            <button
              onClick={() => handlePause(60 * 24)}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-md border transition-colors hover:opacity-80"
              style={{ borderColor: border, color: text, background: bgHover }}
            >
              <Clock size={11} /> Pause 24h
            </button>
          </div>
        )}
      </div>

      {/* ─── Master toggle + per-entity toggles ─────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: textSecondary }}
          >
            Sync scope
          </p>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-[11px]" style={{ color: text }}>
              Master
            </span>
            <input
              type="checkbox"
              checked={settings.syncEnabled}
              onChange={(e) => updateSettings({ syncEnabled: e.target.checked })}
              className="h-3.5 w-3.5 accent-indigo-500"
            />
          </label>
        </div>

        {!settings.syncEnabled && (
          <div
            className="flex items-start gap-2 mb-2 p-2 rounded-md text-[11px]"
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              color: 'rgba(217, 119, 6, 1)',
            }}
          >
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>Sync is disabled. Local edits still queue — they'll push when re-enabled.</span>
          </div>
        )}

        <ul className="space-y-1">
          {ALL_ENTITIES.map((key) => {
            const on = settings.entities[key] !== false;
            const d = dirty?.[key];
            const hasPending = d && d.dirty > 0;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md"
                style={{ background: on ? 'transparent' : bgSecondary }}
              >
                <label className="flex-1 flex items-center gap-2 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!settings.syncEnabled}
                    onChange={(e) =>
                      updateSettings({ entities: { [key]: e.target.checked } })
                    }
                    className="h-3.5 w-3.5 accent-indigo-500 shrink-0"
                  />
                  <span
                    className="text-xs truncate"
                    style={{ color: on ? text : textSecondary }}
                  >
                    {ENTITY_LABELS[key]}
                  </span>
                </label>
                {hasPending && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      background: d!.tombstones > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(99,102,241,0.15)',
                      color: d!.tombstones > 0 ? 'rgb(220,38,38)' : 'rgb(99,102,241)',
                    }}
                    title={
                      d!.tombstones > 0
                        ? `${d!.dirty} pending (${d!.tombstones} deletion${d!.tombstones !== 1 ? 's' : ''})`
                        : `${d!.dirty} pending change${d!.dirty !== 1 ? 's' : ''}`
                    }
                  >
                    {d!.dirty}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
