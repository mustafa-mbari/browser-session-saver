import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { t } from '@shared/utils/i18n';
import type { LucideIcon } from 'lucide-react';
import {
  Search, RotateCcw, RefreshCw, MoreVertical, Pin, Star, Download, Trash2, Lock,
  FolderOpen, Layers2, Clock as ClockIcon, HardDrive,
  SlidersHorizontal, Power, Moon, Battery, WifiOff, Camera, Filter, Scissors, Calendar,
  Save,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import { formatRelative } from '@core/utils/date';
import ContextMenu from '@shared/components/ContextMenu';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import Tooltip from '@shared/components/Tooltip';
import SessionBulkToolbar from './SessionBulkToolbar';
import SessionDiffModal from './SessionDiffModal';
import type { Session, TabGroup } from '@core/types/session.types';
import type { SessionDiffResponse } from '@core/types/messages.types';
import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { GROUP_COLORS } from '@core/constants/tab-group-colors';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function TabGroupPills({ groups }: { groups: TabGroup[] }) {
  if (groups.length === 0) return null;
  const visible = groups.slice(0, 5);
  const remaining = groups.length - 5;
  return (
    <div className="flex items-center gap-1 mt-1">
      {visible.map((g) => (
        <Tooltip key={g.id} content={g.title || g.color}>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: GROUP_COLORS[g.color] ?? '#9CA3AF' }}
          />
        </Tooltip>
      ))}
      {remaining > 0 && (
        <span className="text-[10px]" style={{ color: 'var(--newtab-text-secondary)' }}>
          +{remaining}
        </span>
      )}
    </div>
  );
}

// ── Stats Bar ──────────────────────────────────────────────────────────────────

function SessionStatsBar({ sessions }: { sessions: Session[] }) {
  const totalTabs = sessions.reduce((sum, s) => sum + s.tabCount, 0);
  const autoSaves = sessions.filter((s) => s.isAutoSave).length;
  const estimatedSize = (JSON.stringify(sessions).length / 1024).toFixed(1);

  const stats = [
    { icon: FolderOpen, label: t('sessionsTitle'),  value: sessions.length },
    { icon: Layers2,    label: t('totalTabsLabel'), value: totalTabs },
    { icon: ClockIcon,  label: t('autoSavesTitle'), value: autoSaves },
    { icon: HardDrive,  label: t('storageLabel'),   value: `${estimatedSize} KB` },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="glass-panel rounded-xl px-3 py-2.5 flex flex-col gap-1">
          <Icon size={14} style={{ color: '#818cf8' }} />
          <p className="text-base font-semibold leading-tight" style={{ color: 'var(--newtab-text)' }}>
            {value}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--newtab-text-secondary)' }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Auto-save card ─────────────────────────────────────────────────────────────

const AutoSaveCard = memo(function AutoSaveCard({
  session,
  onRestore,
}: {
  session: Session;
  onRestore: (id: string) => Promise<void>;
}) {
  const [restoring, setRestoring] = useState(false);

  const triggerLabel =
    session.autoSaveTrigger.charAt(0).toUpperCase() +
    session.autoSaveTrigger.slice(1).replace(/_/g, ' ');

  const handleRestore = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoring(true);
    await onRestore(session.id);
    setRestoring(false);
  }, [onRestore, session.id]);

  return (
    <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
      <RefreshCw size={14} className="shrink-0 opacity-40" style={{ color: 'var(--newtab-text)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--newtab-text)' }}>
          {session.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
          {formatRelative(session.createdAt)} · {session.tabCount} tab{session.tabCount !== 1 ? 's' : ''}
        </p>
      </div>
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
        style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
      >
        {triggerLabel}
      </span>
      <span
        className="text-xs px-2 py-0.5 rounded-full shrink-0"
        style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--newtab-text-secondary)' }}
      >
        {session.tabCount} tabs
      </span>
      <button
        onClick={handleRestore}
        disabled={restoring}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/20 disabled:opacity-50 shrink-0"
        style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--newtab-text)' }}
        aria-label="Restore auto-save session"
      >
        {restoring
          ? <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
          : <RotateCcw size={11} />
        }
        Restore
      </button>
    </div>
  );
});

// ── Manual session card ────────────────────────────────────────────────────────

interface ManualSessionCardProps {
  session: Session;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRestore: (id: string) => Promise<void>;
  onUpdateTabs: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Session>) => Promise<void>;
  onExport: (id: string, name: string) => Promise<void>;
}

const ManualSessionCard = memo(function ManualSessionCard({
  session, selected, onToggleSelect, onRestore, onUpdateTabs, onDelete, onUpdate, onExport,
}: ManualSessionCardProps) {
  const [restoring, setRestoring] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleRestore = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoring(true);
    await onRestore(session.id);
    setRestoring(false);
  }, [onRestore, session.id]);

  const handleUpdate = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdating(true);
    await onUpdateTabs(session.id);
    setUpdating(false);
  }, [onUpdateTabs, session.id]);

  const menuItems = useMemo(() => [
    {
      label: session.isPinned ? 'Unpin' : 'Pin',
      icon: Pin,
      onClick: () => onUpdate(session.id, { isPinned: !session.isPinned }),
    },
    {
      label: session.isStarred ? 'Unstar' : 'Star',
      icon: Star,
      onClick: () => onUpdate(session.id, { isStarred: !session.isStarred }),
    },
    {
      label: 'Export',
      icon: Download,
      onClick: () => onExport(session.id, session.name),
    },
    {
      label: session.isLocked ? 'Unlock' : 'Lock',
      icon: Lock,
      onClick: () => onUpdate(session.id, { isLocked: !session.isLocked }),
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => onDelete(session.id),
      danger: true,
    },
  ], [session, onUpdate, onExport, onDelete]);

  return (
    <div
      className="glass-panel rounded-xl px-4 py-3 flex items-start gap-3 transition-all"
      style={selected
        ? { outline: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.1)' }
        : {}}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => { e.stopPropagation(); onToggleSelect(session.id); }}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 w-3.5 h-3.5 shrink-0 rounded accent-indigo-500 cursor-pointer"
        aria-label={`Select ${session.name}`}
      />
      <FolderOpen size={14} className="shrink-0 mt-1 opacity-40" style={{ color: 'var(--newtab-text)' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          {session.isStarred && <Star size={11} fill="currentColor" style={{ color: '#EAB308' }} />}
          {session.isPinned && <Pin size={11} style={{ color: '#6366f1' }} />}
          {session.isLocked && <Lock size={10} className="opacity-50" style={{ color: 'var(--newtab-text-secondary)' }} />}
          <p className="text-sm font-medium truncate" style={{ color: 'var(--newtab-text)' }}>
            {session.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
            {formatRelative(session.createdAt)}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--newtab-text-secondary)' }}
          >
            {session.tabCount} tab{session.tabCount !== 1 ? 's' : ''}
          </span>
          {session.tags.length > 0 && session.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--newtab-text-secondary)' }}
            >
              {tag}
            </span>
          ))}
        </div>
        {session.tabGroups.length > 0 && <TabGroupPills groups={session.tabGroups} />}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/20 disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--newtab-text)' }}
          aria-label="Restore session"
        >
          {restoring
            ? <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
            : <RotateCcw size={11} />
          }
          Restore
        </button>
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/15 disabled:opacity-50"
          style={{ color: 'var(--newtab-text-secondary)' }}
          title="Update with current tabs"
          aria-label="Update session with current tabs"
        >
          {updating
            ? <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
            : <RefreshCw size={13} />
          }
        </button>
        <ContextMenu items={menuItems}>
          <button
            className="p-1.5 rounded-lg transition-colors hover:bg-white/15"
            style={{ color: 'var(--newtab-text-secondary)' }}
            aria-label="More actions"
          >
            <MoreVertical size={13} />
          </button>
        </ContextMenu>
      </div>
    </div>
  );
});

// ── Settings Panel ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full transition-all focus:outline-none"
      style={{
        width: 36,
        height: 20,
        background: checked ? '#6366f1' : 'rgba(255,255,255,0.15)',
      }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0px)' }}
      />
    </button>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon
        ? <Icon size={13} style={{ color: 'var(--newtab-text-secondary)', opacity: 0.65, flexShrink: 0 }} />
        : <span style={{ width: 13, flexShrink: 0 }} />
      }
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-tight" style={{ color: 'var(--newtab-text)' }}>{label}</p>
        {description && (
          <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.7 }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {unit && (
        <span className="text-[10px] shrink-0" style={{ color: 'var(--newtab-text-secondary)' }}>
          {unit}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        min={min}
        max={max}
        className="w-14 text-center text-xs rounded-lg px-1 py-1 outline-none"
        style={{
          background: 'rgba(255,255,255,0.1)',
          color: 'var(--newtab-text)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      />
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  color: 'var(--newtab-text-secondary)',
  opacity: 0.6,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
};

function SessionSettingsPanel() {
  const { sendMessage } = useMessaging();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void sendMessage<Settings>({ action: 'GET_SETTINGS', payload: {} }).then((res) => {
      if (res.success && res.data) setSettings(res.data);
    });
  }, [sendMessage]);

  const update = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      const res = await sendMessage<Settings>({
        action: 'UPDATE_SETTINGS',
        payload: { [key]: value } as Partial<Settings>,
      });
      if (res.success && res.data) setSettings(res.data);
    },
    [sendMessage],
  );

  return (
    <div
      className="flex flex-col gap-3 sticky top-4 overflow-y-auto"
      style={{ width: 272, flexShrink: 0, maxHeight: 'calc(100vh - 80px)' }}
    >
      {/* Header */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-2.5">
        <SlidersHorizontal size={15} style={{ color: '#818cf8' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
          Session Settings
        </h3>
      </div>

      {/* Auto-Save */}
      <div>
        <p style={sectionLabel}>Auto-Save</p>
        <div className="glass-panel rounded-xl px-3 py-2.5 flex flex-col gap-2.5">
          <SettingRow icon={ClockIcon} label="Enable Auto-Save" description="Periodically capture all open tabs">
            <Toggle checked={settings.enableAutoSave} onChange={(v) => update('enableAutoSave', v)} />
          </SettingRow>
          {settings.enableAutoSave && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
              <SettingRow label="Interval">
                <NumInput value={settings.saveInterval} onChange={(v) => update('saveInterval', v)} min={1} max={120} unit="min" />
              </SettingRow>
              <SettingRow label="Max entries">
                <NumInput value={settings.maxAutoSaves} onChange={(v) => update('maxAutoSaves', v)} min={1} max={500} unit="saves" />
              </SettingRow>
            </>
          )}
        </div>
      </div>

      {/* Triggers */}
      {settings.enableAutoSave && (
        <div>
          <p style={sectionLabel}>Triggers</p>
          <div className="glass-panel rounded-xl px-3 py-2.5 flex flex-col gap-2.5">
            <SettingRow icon={Power} label="Browser Close">
              <Toggle checked={settings.saveOnBrowserClose} onChange={(v) => update('saveOnBrowserClose', v)} />
            </SettingRow>
            <SettingRow icon={Moon} label="On Sleep">
              <Toggle checked={settings.saveOnSleep} onChange={(v) => update('saveOnSleep', v)} />
            </SettingRow>
            <SettingRow icon={Battery} label="Low Battery">
              <Toggle checked={settings.saveOnLowBattery} onChange={(v) => update('saveOnLowBattery', v)} />
            </SettingRow>
            {settings.saveOnLowBattery && (
              <SettingRow label="Threshold">
                <NumInput value={settings.lowBatteryThreshold} onChange={(v) => update('lowBatteryThreshold', v)} min={5} max={50} unit="%" />
              </SettingRow>
            )}
            <SettingRow icon={WifiOff} label="Network Drop">
              <Toggle checked={settings.saveOnNetworkDisconnect} onChange={(v) => update('saveOnNetworkDisconnect', v)} />
            </SettingRow>
          </div>
        </div>
      )}

      {/* Behavior */}
      <div>
        <p style={sectionLabel}>Behavior</p>
        <div className="glass-panel rounded-xl px-3 py-2.5 flex flex-col gap-2.5">
          <SettingRow
            icon={Camera}
            label="Snapshot Mode"
            description="Remove closed tabs from auto-save"
          >
            <Toggle checked={settings.autoSaveOnTabClose} onChange={(v) => update('autoSaveOnTabClose', v)} />
          </SettingRow>
          <SettingRow
            icon={Filter}
            label="Sync on Update"
            description="Remove tabs no longer open when updating a session"
          >
            <Toggle checked={settings.removeClosedTabsOnUpdate} onChange={(v) => update('removeClosedTabsOnUpdate', v)} />
          </SettingRow>
          <SettingRow
            icon={Scissors}
            label="Close After Save"
            description="Close tabs when manually saving a session"
          >
            <Toggle checked={settings.closeTabsAfterSave} onChange={(v) => update('closeTabsAfterSave', v)} />
          </SettingRow>
        </div>
      </div>

      {/* Cleanup */}
      <div>
        <p style={sectionLabel}>Cleanup</p>
        <div className="glass-panel rounded-xl px-3 py-2.5 flex flex-col gap-2.5">
          <SettingRow
            icon={Calendar}
            label="Auto-Delete"
            description={
              settings.autoDeleteAfterDays === null
                ? 'Keep sessions forever'
                : `Delete sessions older than ${settings.autoDeleteAfterDays} days`
            }
          >
            <Toggle
              checked={settings.autoDeleteAfterDays !== null}
              onChange={(v) => update('autoDeleteAfterDays', v ? 30 : null)}
            />
          </SettingRow>
          {settings.autoDeleteAfterDays !== null && (
            <SettingRow label="Delete after">
              <NumInput
                value={settings.autoDeleteAfterDays}
                onChange={(v) => update('autoDeleteAfterDays', v)}
                min={1}
                max={365}
                unit="days"
              />
            </SettingRow>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function SessionsPanel() {
  const { sessions, loading, restoreSession, deleteSession, updateSession, updateSessionTabs, refreshSessions } = useSession();
  const { sendMessage } = useMessaging();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [diffResult, setDiffResult] = useState<SessionDiffResponse | null>(null);
  const [diffSessions, setDiffSessions] = useState<[Session, Session] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveSession = useCallback(async () => {
    const defaultName = `Session — ${new Date().toLocaleString()}`;
    const name = window.prompt('Session name:', defaultName);
    if (name === null) return; // cancelled
    setSaving(true);
    await sendMessage({ action: 'SAVE_SESSION', payload: { name: name.trim() || defaultName } });
    await refreshSessions();
    setSaving(false);
  }, [sendMessage, refreshSessions]);

  const autoSaves = useMemo(() => sessions.filter((s) => s.isAutoSave), [sessions]);

  const filteredManual = useMemo(() => {
    const manual = sessions.filter((s) => !s.isAutoSave);
    const q = query.toLowerCase();
    if (!q) return manual;
    return manual.filter(
      (s) => s.name.toLowerCase().includes(q) || s.tags?.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [sessions, query]);

  const sortedManual = useMemo(() => {
    const pinned = filteredManual.filter((s) => s.isPinned);
    const rest = [...filteredManual.filter((s) => !s.isPinned)].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return [...pinned, ...rest];
  }, [filteredManual]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleRestore = useCallback(async (id: string) => {
    await restoreSession(id, 'new_window');
  }, [restoreSession]);

  const handleUpdateTabs = useCallback(async (id: string) => {
    await updateSessionTabs(id);
  }, [updateSessionTabs]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSession(id);
  }, [deleteSession]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Session>) => {
    await updateSession(id, updates);
  }, [updateSession]);

  const handleExport = useCallback(async (id: string, name: string) => {
    const res = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: [id], format: 'json' },
    });
    if (res.success && res.data) {
      const blob = new Blob([res.data as string], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [sendMessage]);

  const handleBulkExport = useCallback(async (ids: string[]) => {
    const res = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: ids, format: 'json' },
    });
    if (res.success && res.data) {
      const blob = new Blob([res.data as string], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'browser-hub-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    clearSelection();
  }, [sendMessage, clearSelection]);

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    for (const id of ids) await deleteSession(id);
    clearSelection();
  }, [deleteSession, clearSelection]);

  const handleBulkMerge = useCallback(async (ids: string[]) => {
    const defaultName = `Merged Session — ${new Date().toLocaleDateString()}`;
    const name = window.prompt('Name for merged session:', defaultName) ?? defaultName;
    const res = await sendMessage<Session>({
      action: 'MERGE_SESSIONS',
      payload: { sessionIds: ids, targetName: name },
    });
    if (res.success) {
      clearSelection();
      await refreshSessions();
    }
  }, [sendMessage, clearSelection, refreshSessions]);

  const handleBulkCompare = useCallback(async (ids: [string, string]) => {
    const [idA, idB] = ids;
    const res = await sendMessage<SessionDiffResponse>({
      action: 'DIFF_SESSIONS',
      payload: { sessionIdA: idA, sessionIdB: idB },
    });
    if (res.success && res.data) {
      const sA = sessions.find((s) => s.id === idA)!;
      const sB = sessions.find((s) => s.id === idB)!;
      setDiffResult(res.data);
      setDiffSessions([sA, sB]);
    }
  }, [sendMessage, sessions]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sortedManual.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 82,
    overscan: 8,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const hasNoManual = sessions.filter((s) => !s.isAutoSave).length === 0;

  return (
    <div className="pt-4 w-full flex gap-6 items-start">
      {/* ── Left: session list ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
            {t('sessionsTitle')}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--newtab-text-secondary)' }}>
              {t('nSaved', String(sessions.length))}
            </span>
            <button
              onClick={() => { void handleSaveSession(); }}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}
            >
              {saving
                ? <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                : <Save size={12} />
              }
              Save Session
            </button>
          </div>
        </div>

        <SessionStatsBar sessions={sessions} />

        <div className="relative mb-4">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--newtab-text-secondary)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchSessionsPlaceholder')}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
            style={{
              color: 'var(--newtab-text)',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          />
        </div>

        {autoSaves.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {autoSaves.map((s) => (
              <AutoSaveCard key={s.id} session={s} onRestore={handleRestore} />
            ))}
          </div>
        )}

        {autoSaves.length > 0 && !hasNoManual && (
          <div className="mb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
        )}

        {sortedManual.length === 0 ? (
          hasNoManual ? (
            <div className="text-center py-16 glass-panel rounded-xl" style={{ color: 'var(--newtab-text-secondary)' }}>
              <FolderOpen size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-base">{t('noSessions')}</p>
              <p className="text-sm mt-1 opacity-60">{t('noSessionsDesc')}</p>
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--newtab-text-secondary)' }}>
              <p className="text-base">No sessions match your search</p>
            </div>
          )
        ) : sortedManual.length <= 30 ? (
          <div className="flex flex-col gap-2">
            {sortedManual.map((session) => (
              <ManualSessionCard
                key={session.id}
                session={session}
                selected={selectedIds.has(session.id)}
                onToggleSelect={toggleSelect}
                onRestore={handleRestore}
                onUpdateTabs={handleUpdateTabs}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onExport={handleExport}
              />
            ))}
          </div>
        ) : (
          <div ref={scrollRef} style={{ height: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vItem) => (
                <div
                  key={vItem.key}
                  style={{ position: 'absolute', top: vItem.start, left: 0, width: '100%', paddingBottom: 8 }}
                >
                  <ManualSessionCard
                    session={sortedManual[vItem.index]}
                    selected={selectedIds.has(sortedManual[vItem.index].id)}
                    onToggleSelect={toggleSelect}
                    onRestore={handleRestore}
                    onUpdateTabs={handleUpdateTabs}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onExport={handleExport}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <SessionBulkToolbar
          selectedIds={selectedIds}
          onClear={clearSelection}
          onExport={handleBulkExport}
          onDelete={handleBulkDelete}
          onMerge={handleBulkMerge}
          onCompare={handleBulkCompare}
        />

        {diffSessions && (
          <SessionDiffModal
            diffResult={diffResult}
            sessions={diffSessions}
            onClose={() => { setDiffSessions(null); setDiffResult(null); }}
          />
        )}
      </div>

      {/* ── Right: settings ── */}
      <SessionSettingsPanel />
    </div>
  );
}
