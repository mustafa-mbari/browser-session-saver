import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Monitor,
} from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import type { ChromeGroupColor } from '@core/types/session.types';
import EmptyState from '@shared/components/EmptyState';
import LoadingSpinner from '@shared/components/LoadingSpinner';

// ── Constants ──────────────────────────────────────────────────────────────────

const GROUP_COLOR_MAP: Record<string, string> = {
  grey: '#9aa0a6',
  blue: '#4a90d9',
  red: '#e06666',
  yellow: '#f6b26b',
  green: '#6aa84f',
  pink: '#d16b8e',
  purple: '#8e44ad',
  cyan: '#45b7d1',
  orange: '#e69138',
};

const COLOR_OPTIONS: ChromeGroupColor[] = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiveGroup {
  id: number;
  title: string;
  color: ChromeGroupColor;
  collapsed: boolean;
  windowId: number;
  tabs: chrome.tabs.Tab[];
}

interface SavedGroupInfo {
  key: string;
  title: string;
  color: ChromeGroupColor;
  sessionCount: number;
  totalTabs: number;
  tabUrls: string[];
  tabTitles: string[];
  tabFavIcons: string[];
  sessionIds: string[];
  isLive: boolean;
}

// ── Color Picker ───────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: ChromeGroupColor;
  onChange: (c: ChromeGroupColor) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          className={`w-5 h-5 rounded-full border-2 transition-all ${
            value === c ? 'border-white scale-110' : 'border-transparent hover:border-white/50'
          }`}
          style={{ backgroundColor: GROUP_COLOR_MAP[c] }}
        />
      ))}
    </div>
  );
}

// ── Live Group Row ─────────────────────────────────────────────────────────────

interface LiveGroupRowProps {
  group: LiveGroup;
  onRefresh: () => void;
}

function LiveGroupRow({ group, onRefresh }: LiveGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(group.title);
  const [draftColor, setDraftColor] = useState<ChromeGroupColor>(group.color);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accentColor = GROUP_COLOR_MAP[group.color] ?? '#9aa0a6';

  const startEdit = () => {
    setDraftTitle(group.title);
    setDraftColor(group.color);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await chrome.tabGroups.update(group.id, {
        title: draftTitle.trim() || group.title,
        color: draftColor,
      });
      setEditing(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftTitle(group.title);
    setDraftColor(group.color);
  };

  const handleUngroup = async () => {
    const tabIds = group.tabs.map((t) => t.id!).filter(Boolean);
    if (tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
      onRefresh();
    }
  };

  const handleOpenInNewWindow = async () => {
    const newWindow = await chrome.windows.create({ focused: true });
    const windowId = newWindow.id!;
    const tabIds: number[] = [];
    for (const tab of group.tabs) {
      const created = await chrome.tabs.create({ url: tab.url, windowId, active: false });
      if (created.id) tabIds.push(created.id);
    }
    // Remove the blank tab that opens with a new window
    const windowTabs = await chrome.tabs.query({ windowId });
    const blank = windowTabs.find((t) => !t.url || t.url === 'chrome://newtab/');
    if (blank?.id) await chrome.tabs.remove(blank.id).catch(() => null);
    if (tabIds.length > 0) {
      const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      await chrome.tabGroups.update(newGroupId, {
        title: group.title,
        color: group.color,
      });
    }
  };

  const handleFocusGroup = async () => {
    const firstTab = group.tabs[0];
    if (firstTab?.id) {
      await chrome.windows.update(group.windowId, { focused: true });
      await chrome.tabs.update(firstTab.id, { active: true });
    }
  };

  const toggleCollapse = async () => {
    await chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
    onRefresh();
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      {/* Accent bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />

      {/* Header */}
      <div className="px-3 py-2">
        {editing ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                placeholder="Group name"
                className="flex-1 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text)] outline-none focus:border-blue-500"
              />
              <button
                onClick={() => void saveEdit()}
                disabled={saving}
                className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
              >
                <Check size={12} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <X size={12} />
              </button>
            </div>
            <ColorPicker value={draftColor} onChange={setDraftColor} />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center gap-1 text-left min-w-0"
            >
              <span className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>
                {group.title || 'Unnamed group'}
              </span>
              {expanded
                ? <ChevronDown size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              <span className="text-xs mr-1" style={{ color: 'var(--color-text-secondary)' }}>
                {group.tabs.length}t
              </span>
              {group.collapsed && (
                <button
                  onClick={() => void toggleCollapse()}
                  className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-bg-secondary)] hover:opacity-80 transition-opacity mr-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Click to expand in browser"
                >
                  collapsed
                </button>
              )}
              <button
                onClick={() => void handleFocusGroup()}
                className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Focus in browser"
              >
                <Monitor size={12} />
              </button>
              <button
                onClick={startEdit}
                className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Edit name & color"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={() => void handleOpenInNewWindow()}
                className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Open in new window"
              >
                <ExternalLink size={12} />
              </button>
              <button
                onClick={() => void handleUngroup()}
                className="p-1 rounded hover:bg-red-500/20 transition-colors text-red-400"
                title="Ungroup (remove grouping, keep tabs)"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab list */}
      {expanded && !editing && (
        <div className="border-t border-[var(--color-border)] max-h-44 overflow-auto">
          {group.tabs.map((tab) => (
            <button
              key={tab.id}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
              onClick={() => tab.id && void chrome.tabs.update(tab.id, { active: true })}
            >
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-sm bg-white/20 shrink-0" />
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                {tab.title || tab.url || 'New Tab'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Saved Group Row ────────────────────────────────────────────────────────────

interface SavedGroupRowProps {
  info: SavedGroupInfo;
  onRestore: (info: SavedGroupInfo) => Promise<void>;
}

function SavedGroupRow({ info, onRestore }: SavedGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const accentColor = GROUP_COLOR_MAP[info.color] ?? '#9aa0a6';

  const handleRestore = async () => {
    setRestoring(true);
    await onRestore(info);
    setRestoring(false);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />

      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 flex items-center gap-1 text-left min-w-0"
          >
            <span className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>
              {info.title || 'Unnamed group'}
            </span>
            {expanded
              ? <ChevronDown size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
              : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {info.isLive && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {info.totalTabs}t · {info.sessionCount}s
            </span>
            <button
              onClick={() => void handleRestore()}
              disabled={restoring}
              className="text-xs px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
              title="Restore group in a new window"
            >
              {restoring ? '…' : 'Restore'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-border)] max-h-40 overflow-auto">
          {info.tabTitles.slice(0, 20).map((title, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              {info.tabFavIcons[i] ? (
                <img src={info.tabFavIcons[i]} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-sm bg-white/10 shrink-0" />
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                {title || info.tabUrls[i] || 'Unknown'}
              </span>
            </div>
          ))}
          {info.tabTitles.length > 20 && (
            <p className="text-xs text-center py-1 opacity-40" style={{ color: 'var(--color-text-secondary)' }}>
              +{info.tabTitles.length - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export default function TabGroupsView() {
  const { sessions, loading: sessionsLoading } = useSession();
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'saved'>('live');
  const [search, setSearch] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const loadLiveGroups = useCallback(async () => {
    setLiveLoading(true);
    try {
      const [groups, tabs] = await Promise.all([
        chrome.tabGroups.query({}),
        chrome.tabs.query({}),
      ]);
      const tabsByGroup = new Map<number, chrome.tabs.Tab[]>();
      for (const tab of tabs) {
        if (tab.groupId && tab.groupId > 0) {
          const arr = tabsByGroup.get(tab.groupId) ?? [];
          arr.push(tab);
          tabsByGroup.set(tab.groupId, arr);
        }
      }
      setLiveGroups(
        groups.map((g) => ({
          id: g.id,
          title: g.title || 'Unnamed',
          color: (g.color as ChromeGroupColor) ?? 'grey',
          collapsed: g.collapsed,
          windowId: g.windowId,
          tabs: tabsByGroup.get(g.id) ?? [],
        })),
      );
    } catch {
      setLiveGroups([]);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLiveGroups();
  }, [loadLiveGroups]);

  const savedGroups = useMemo((): SavedGroupInfo[] => {
    const liveKeys = new Set(liveGroups.map((g) => `${g.title}-${g.color}`));
    const map = new Map<string, SavedGroupInfo>();

    for (const session of sessions) {
      for (const group of session.tabGroups) {
        const key = `${group.title}-${group.color}`;
        const groupTabs = session.tabs.filter((t) => t.groupId === group.id);
        const existing = map.get(key);
        if (existing) {
          existing.sessionCount++;
          existing.totalTabs += groupTabs.length;
          if (!existing.sessionIds.includes(session.id)) {
            existing.sessionIds.push(session.id);
          }
        } else {
          map.set(key, {
            key,
            title: group.title || 'Unnamed',
            color: group.color,
            sessionCount: 1,
            totalTabs: groupTabs.length,
            tabUrls: groupTabs.map((t) => t.url),
            tabTitles: groupTabs.map((t) => t.title),
            tabFavIcons: groupTabs.map((t) => t.favIconUrl),
            sessionIds: [session.id],
            isLive: liveKeys.has(key),
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [sessions, liveGroups]);

  const handleRestoreSaved = useCallback(
    async (info: SavedGroupInfo) => {
      const session = sessions.find((s) =>
        s.tabGroups.some((g) => `${g.title}-${g.color}` === info.key),
      );
      if (!session) return;
      const group = session.tabGroups.find((g) => `${g.title}-${g.color}` === info.key);
      if (!group) return;
      const groupTabs = session.tabs.filter((t) => t.groupId === group.id);
      if (groupTabs.length === 0) return;

      const newWindow = await chrome.windows.create({ focused: true });
      const windowId = newWindow.id!;
      const tabIds: number[] = [];
      for (const tab of groupTabs) {
        const created = await chrome.tabs.create({ url: tab.url, windowId, active: false });
        if (created.id) tabIds.push(created.id);
      }
      const windowTabs = await chrome.tabs.query({ windowId });
      const blank = windowTabs.find((t) => !t.url || t.url === 'chrome://newtab/');
      if (blank?.id) await chrome.tabs.remove(blank.id).catch(() => null);
      if (tabIds.length > 0) {
        const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
        await chrome.tabGroups.update(newGroupId, { title: group.title, color: group.color });
      }
      await loadLiveGroups();
      setActiveTab('live');
    },
    [sessions, loadLiveGroups],
  );

  const handleCreateGroup = async () => {
    setCreatingGroup(true);
    try {
      const tab = await chrome.tabs.create({ active: false });
      if (tab.id) {
        const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
        await chrome.tabGroups.update(groupId, { title: 'New Group', color: 'blue' });
        await chrome.tabs.update(tab.id, { active: true });
      }
      await loadLiveGroups();
      setActiveTab('live');
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredLive = liveGroups.filter(
    (g) => !search || g.title.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredSaved = savedGroups.filter(
    (g) => !search || g.title.toLowerCase().includes(search.toLowerCase()),
  );

  const loading = sessionsLoading || liveLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Search + actions bar */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center gap-2">
        <input
          type="search"
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-[var(--color-text)] placeholder:opacity-50 outline-none focus:border-blue-500"
        />
        <button
          onClick={() => void loadLiveGroups()}
          className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Refresh live groups"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={() => void handleCreateGroup()}
          disabled={creatingGroup}
          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
          title="Create a new tab group in browser"
        >
          <Plus size={12} /> New
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'live'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live{liveGroups.length > 0 ? ` (${liveGroups.length})` : ''}
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'saved'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
          }`}
        >
          <Layers size={12} />
          Saved{savedGroups.length > 0 ? ` (${savedGroups.length})` : ''}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center pt-8">
            <LoadingSpinner />
          </div>
        ) : activeTab === 'live' ? (
          filteredLive.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No active tab groups"
              description={
                search
                  ? 'No groups match your search.'
                  : 'Group some tabs in your browser, then click Refresh.'
              }
            />
          ) : (
            filteredLive.map((g) => (
              <LiveGroupRow
                key={g.id}
                group={g}
                onRefresh={() => void loadLiveGroups()}
              />
            ))
          )
        ) : filteredSaved.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No saved tab groups"
            description={
              search
                ? 'No groups match your search.'
                : 'Tab groups from your saved sessions will appear here.'
            }
          />
        ) : (
          filteredSaved.map((info) => (
            <SavedGroupRow
              key={info.key}
              info={info}
              onRestore={handleRestoreSaved}
            />
          ))
        )}
      </div>
    </div>
  );
}
