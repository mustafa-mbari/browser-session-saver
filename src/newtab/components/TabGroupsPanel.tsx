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
import LoadingSpinner from '@shared/components/LoadingSpinner';
import type { ChromeGroupColor } from '@core/types/session.types';

// ── Constants ──────────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
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

interface SavedGroup {
  key: string;
  title: string;
  color: ChromeGroupColor;
  sessionCount: number;
  totalTabs: number;
  tabUrls: string[];
  tabTitles: string[];
  tabFavIcons: string[];
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
    <div className="flex items-center gap-1.5 flex-wrap">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          className={`w-5 h-5 rounded-full border-2 transition-all ${
            value === c ? 'border-white scale-110' : 'border-transparent hover:border-white/50'
          }`}
          style={{ backgroundColor: GROUP_COLORS[c] }}
        />
      ))}
    </div>
  );
}

// ── Live Group Card ────────────────────────────────────────────────────────────

function LiveGroupCard({ group, onRefresh }: { group: LiveGroup; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(group.title);
  const [draftColor, setDraftColor] = useState<ChromeGroupColor>(group.color);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accentColor = GROUP_COLORS[group.color] ?? '#9aa0a6';

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
    const windowTabs = await chrome.tabs.query({ windowId });
    const blank = windowTabs.find((t) => !t.url || t.url === 'chrome://newtab/');
    if (blank?.id) await chrome.tabs.remove(blank.id).catch(() => null);
    if (tabIds.length > 0) {
      const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      await chrome.tabGroups.update(newGroupId, { title: group.title, color: group.color });
    }
  };

  const handleFocus = async () => {
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
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      <div className="p-4">
        {/* Live badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
          <span className="text-xs ml-auto" style={{ color: 'var(--newtab-text-secondary)' }}>
            {group.tabs.length} tab{group.tabs.length !== 1 ? 's' : ''}
            {group.collapsed && ' · collapsed'}
          </span>
        </div>

        {/* Title / Edit */}
        {editing ? (
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                placeholder="Group name"
                className="flex-1 text-sm rounded-md px-2 py-1 outline-none bg-white/10 border border-white/20 focus:border-white/50"
                style={{ color: 'var(--newtab-text)' }}
              />
              <button
                onClick={() => void saveEdit()}
                disabled={saving}
                className="p-1.5 rounded-md bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 transition-colors disabled:opacity-50"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                <X size={13} />
              </button>
            </div>
            <ColorPicker value={draftColor} onChange={setDraftColor} />
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span
              className="font-semibold text-sm flex-1 truncate"
              style={{ color: 'var(--newtab-text)' }}
            >
              {group.title || 'Unnamed group'}
            </span>
          </div>
        )}

        {/* Action buttons */}
        {!editing && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => void handleFocus()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
              title="Focus in browser"
            >
              <Monitor size={11} /> Focus
            </button>
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
              title="Edit name & color"
            >
              <Edit2 size={11} /> Edit
            </button>
            {group.collapsed ? (
              <button
                onClick={() => void toggleCollapse()}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                style={{ color: 'var(--newtab-text)' }}
              >
                Expand
              </button>
            ) : (
              <button
                onClick={() => void toggleCollapse()}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                style={{ color: 'var(--newtab-text)' }}
              >
                Collapse
              </button>
            )}
            <button
              onClick={() => void handleOpenInNewWindow()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
              title="Open in new window"
            >
              <ExternalLink size={11} /> New Win
            </button>
            <button
              onClick={() => void handleUngroup()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors ml-auto"
              title="Ungroup (remove grouping)"
            >
              <Trash2 size={11} /> Ungroup
            </button>
          </div>
        )}

        {/* Tab list toggle */}
        {!editing && group.tabs.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1.5 text-xs w-full hover:opacity-80 transition-opacity"
            style={{ color: 'var(--newtab-text-secondary)' }}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {expanded ? 'Hide tabs' : 'Show tabs'}
          </button>
        )}
      </div>

      {/* Tab list */}
      {expanded && !editing && (
        <div className="border-t border-white/10 max-h-52 overflow-auto px-2 py-1">
          {group.tabs.map((tab) => (
            <button
              key={tab.id}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-white/10 transition-colors text-left"
              onClick={() => tab.id && void chrome.tabs.update(tab.id, { active: true })}
            >
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-sm bg-white/20 shrink-0" />
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--newtab-text)' }}>
                {tab.title || tab.url || 'New Tab'}
              </span>
              <ExternalLink size={9} className="shrink-0 opacity-30" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Saved Group Card ───────────────────────────────────────────────────────────

function SavedGroupCard({
  group,
  onRestore,
}: {
  group: SavedGroup;
  onRestore: (g: SavedGroup) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const accentColor = GROUP_COLORS[group.color] ?? '#9aa0a6';

  const handleRestore = async () => {
    setRestoring(true);
    await onRestore(group);
    setRestoring(false);
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {group.isLive && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
          <span className="text-xs ml-auto" style={{ color: 'var(--newtab-text-secondary)' }}>
            {group.totalTabs}t · {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span
            className="font-semibold text-sm flex-1 truncate"
            style={{ color: 'var(--newtab-text)' }}
          >
            {group.title || 'Unnamed group'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => void handleRestore()}
            disabled={restoring}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors disabled:opacity-50"
          >
            <ExternalLink size={11} />
            {restoring ? 'Restoring…' : 'Restore in New Window'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors ml-auto"
            style={{ color: 'var(--newtab-text)' }}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Tabs
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 max-h-52 overflow-auto px-2 py-1">
          {group.tabTitles.slice(0, 20).map((title, i) => (
            <a
              key={i}
              href={group.tabUrls[i]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-white/10 transition-colors"
            >
              {group.tabFavIcons[i] ? (
                <img src={group.tabFavIcons[i]} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-sm bg-white/20 shrink-0" />
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--newtab-text)' }}>
                {title || group.tabUrls[i] || 'Unknown'}
              </span>
              <ExternalLink size={9} className="shrink-0 opacity-30" />
            </a>
          ))}
          {group.tabTitles.length > 20 && (
            <p className="text-xs text-center py-1 opacity-40" style={{ color: 'var(--newtab-text-secondary)' }}>
              +{group.tabTitles.length - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function TabGroupsPanel() {
  const { sessions, loading: sessionsLoading } = useSession();
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'saved'>('live');
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

  const savedGroups = useMemo((): SavedGroup[] => {
    const liveKeys = new Set(liveGroups.map((g) => `${g.title}-${g.color}`));
    const map = new Map<string, SavedGroup>();
    for (const session of sessions) {
      for (const group of session.tabGroups) {
        const key = `${group.title}-${group.color}`;
        const groupTabs = session.tabs.filter((t) => t.groupId === group.id);
        const existing = map.get(key);
        if (existing) {
          existing.sessionCount++;
          existing.totalTabs += groupTabs.length;
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
            isLive: liveKeys.has(key),
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [sessions, liveGroups]);

  const handleRestoreSaved = useCallback(
    async (info: SavedGroup) => {
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
    <div className="pt-4 flex flex-col gap-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
            Tab Groups
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
            {liveGroups.length} live · {savedGroups.length} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search groups…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm rounded-xl px-3 py-1.5 outline-none bg-white/10 border border-white/15 focus:border-white/40 w-44"
            style={{ color: 'var(--newtab-text)' }}
          />
          <button
            onClick={() => void loadLiveGroups()}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            style={{ color: 'var(--newtab-text)' }}
            title="Refresh live groups"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => void handleCreateGroup()}
            disabled={creatingGroup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm transition-colors disabled:opacity-50"
          >
            <Plus size={14} /> New Group
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 self-start">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'live'
              ? 'bg-white/15 shadow-sm'
              : 'hover:bg-white/10'
          }`}
          style={{ color: 'var(--newtab-text)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live{liveGroups.length > 0 ? ` (${liveGroups.length})` : ''}
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'saved'
              ? 'bg-white/15 shadow-sm'
              : 'hover:bg-white/10'
          }`}
          style={{ color: 'var(--newtab-text)' }}
        >
          <Layers size={13} />
          Saved{savedGroups.length > 0 ? ` (${savedGroups.length})` : ''}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center pt-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : activeTab === 'live' ? (
        filteredLive.length === 0 ? (
          <div
            className="text-center py-16 glass-panel rounded-xl"
            style={{ color: 'var(--newtab-text-secondary)' }}
          >
            <Layers size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-base">
              {search ? 'No groups match your search' : 'No active tab groups'}
            </p>
            <p className="text-sm mt-1 opacity-60">
              {search
                ? 'Try a different search term'
                : 'Group some tabs in your browser, then click Refresh'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredLive.map((g) => (
              <LiveGroupCard key={g.id} group={g} onRefresh={() => void loadLiveGroups()} />
            ))}
          </div>
        )
      ) : filteredSaved.length === 0 ? (
        <div
          className="text-center py-16 glass-panel rounded-xl"
          style={{ color: 'var(--newtab-text-secondary)' }}
        >
          <Layers size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-base">
            {search ? 'No groups match your search' : 'No saved tab groups'}
          </p>
          <p className="text-sm mt-1 opacity-60">
            {search ? 'Try a different search term' : 'Tab groups from saved sessions appear here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSaved.map((g) => (
            <SavedGroupCard key={g.key} group={g} onRestore={handleRestoreSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
