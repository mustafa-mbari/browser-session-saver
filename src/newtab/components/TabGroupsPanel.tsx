import { useState, useEffect, useCallback, useRef } from 'react';
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
import LoadingSpinner from '@shared/components/LoadingSpinner';
import type { ChromeGroupColor } from '@core/types/session.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';

// ── Constants ──────────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  grey:   '#9aa0a6',
  blue:   '#4a90d9',
  red:    '#e06666',
  yellow: '#f6b26b',
  green:  '#6aa84f',
  pink:   '#d16b8e',
  purple: '#8e44ad',
  cyan:   '#45b7d1',
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

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Open tabs from a template in the current window and create a group there. */
async function restoreInCurrentWindow(template: TabGroupTemplate): Promise<void> {
  const currentWindow = await chrome.windows.getCurrent();
  const windowId = currentWindow.id!;
  const tabIds: number[] = [];
  for (const tab of template.tabs) {
    const created = await chrome.tabs.create({ url: tab.url, windowId, active: false });
    if (created.id) tabIds.push(created.id);
  }
  if (tabIds.length > 0) {
    const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
    await chrome.tabGroups.update(newGroupId, {
      title: template.title,
      color: template.color,
    });
    // Focus the first restored tab
    await chrome.tabs.update(tabIds[0], { active: true });
  }
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
        {/* Live badge + tab count */}
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
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
            <span className="font-semibold text-sm flex-1 truncate" style={{ color: 'var(--newtab-text)' }}>
              {group.title || 'Unnamed group'}
            </span>
          </div>
        )}

        {!editing && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => void handleFocus()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
            >
              <Monitor size={11} /> Focus
            </button>
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
            >
              <Edit2 size={11} /> Edit
            </button>
            <button
              onClick={() => void toggleCollapse()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
            >
              {group.collapsed ? 'Expand' : 'Collapse'}
            </button>
            <button
              onClick={() => void handleUngroup()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors ml-auto"
              title="Remove grouping (tabs stay open)"
            >
              <Trash2 size={11} /> Ungroup
            </button>
          </div>
        )}

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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Saved Group Card ───────────────────────────────────────────────────────────

function SavedGroupCard({
  template,
  onDelete,
  onRestore,
}: {
  template: TabGroupTemplate;
  onDelete: (key: string) => Promise<void>;
  onRestore: (template: TabGroupTemplate) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const accentColor = GROUP_COLORS[template.color] ?? '#9aa0a6';
  const savedDate = new Date(template.updatedAt).toLocaleDateString('default', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="glass-panel rounded-xl overflow-hidden transition-opacity"
      style={{ opacity: deleting ? 0.4 : 1 }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
            {template.tabs.length} tab{template.tabs.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs ml-auto opacity-50" style={{ color: 'var(--newtab-text-secondary)' }}>
            {savedDate}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
          <span className="font-semibold text-sm flex-1 truncate" style={{ color: 'var(--newtab-text)' }}>
            {template.title || 'Unnamed group'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={async () => {
              setRestoring(true);
              await onRestore(template);
              setRestoring(false);
            }}
            disabled={restoring}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors disabled:opacity-50"
            title="Restore this group in the current window"
          >
            <ExternalLink size={11} />
            {restoring ? 'Restoring…' : 'Restore Here'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
            style={{ color: 'var(--newtab-text)' }}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Tabs
          </button>
          <button
            onClick={async () => {
              setDeleting(true);
              await onDelete(template.key);
            }}
            disabled={deleting}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors ml-auto disabled:opacity-50"
            title="Remove from saved list"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 max-h-52 overflow-auto px-2 py-1">
          {template.tabs.slice(0, 20).map((tab, i) => (
            <a
              key={i}
              href={tab.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-white/10 transition-colors"
            >
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-sm bg-white/20 shrink-0" />
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--newtab-text)' }}>
                {tab.title || tab.url || 'Unknown'}
              </span>
              <ExternalLink size={9} className="shrink-0 opacity-30" />
            </a>
          ))}
          {template.tabs.length > 20 && (
            <p className="text-xs text-center py-1 opacity-40" style={{ color: 'var(--newtab-text-secondary)' }}>
              +{template.tabs.length - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function TabGroupsPanel() {
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<TabGroupTemplate[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const reloadSaved = useCallback(async () => {
    const all = await TabGroupTemplateStorage.getAll();
    all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setSavedTemplates(all);
    setSavedLoading(false);
  }, []);

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
      const live: LiveGroup[] = groups.map((g) => ({
        id: g.id,
        title: g.title || 'Unnamed',
        color: (g.color as ChromeGroupColor) ?? 'grey',
        collapsed: g.collapsed,
        windowId: g.windowId,
        tabs: tabsByGroup.get(g.id) ?? [],
      }));
      setLiveGroups(live);

      // Auto-save every live group (with tabs) to persistent template storage
      const now = new Date().toISOString();
      await Promise.all(
        live
          .filter((g) => g.tabs.length > 0)
          .map((g) =>
            TabGroupTemplateStorage.upsert({
              key: `${g.title}-${g.color}`,
              title: g.title,
              color: g.color,
              tabs: g.tabs.map((t) => ({
                url: t.url ?? '',
                title: t.title ?? '',
                favIconUrl: t.favIconUrl ?? '',
              })),
              savedAt: now,
              updatedAt: now,
            }),
          ),
      );
      // Refresh saved list to reflect any new auto-saves
      await reloadSaved();
    } catch {
      setLiveGroups([]);
    } finally {
      setLiveLoading(false);
    }
  }, [reloadSaved]);

  useEffect(() => {
    void loadLiveGroups();
  }, [loadLiveGroups]);

  // liveKeys for filtering: saved tab only shows groups NOT currently live
  const liveKeys = new Set(liveGroups.map((g) => `${g.title}-${g.color}`));
  const offlineTemplates = savedTemplates.filter((t) => !liveKeys.has(t.key));

  const handleRestoreTemplate = useCallback(
    async (template: TabGroupTemplate) => {
      await restoreInCurrentWindow(template);
      await loadLiveGroups();
    },
    [loadLiveGroups],
  );

  const handleDeleteTemplate = useCallback(
    async (key: string) => {
      await TabGroupTemplateStorage.delete(key);
      await reloadSaved();
    },
    [reloadSaved],
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
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredLive = liveGroups.filter(
    (g) => !search || g.title.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredSaved = offlineTemplates.filter(
    (t) => !search || t.title.toLowerCase().includes(search.toLowerCase()),
  );

  const loading = liveLoading || savedLoading;

  return (
    <div className="pt-4 flex flex-col gap-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
            Tab Groups
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
            {liveGroups.length} live · {offlineTemplates.length} saved (not open)
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

      {/* Split layout: Live | Not Open */}
      {loading ? (
        <div className="flex items-center justify-center pt-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="flex gap-0 rounded-xl overflow-hidden border border-white/10">

          {/* ── Live column ── */}
          <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
            {/* Column header */}
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
                Live
              </h3>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium"
              >
                {filteredLive.length}
              </span>
            </div>

            {filteredLive.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 gap-2"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                <Layers size={28} className="opacity-25" />
                <p className="text-sm opacity-70">
                  {search ? 'No groups match search' : 'No active tab groups'}
                </p>
                <p className="text-xs opacity-40 text-center max-w-[16rem]">
                  {search
                    ? 'Try a different term'
                    : 'Group some tabs in your browser, then click Refresh'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredLive.map((g) => (
                  <LiveGroupCard key={g.id} group={g} onRefresh={() => void loadLiveGroups()} />
                ))}
              </div>
            )}
          </div>

          {/* Vertical divider */}
          <div className="w-px bg-white/10 self-stretch shrink-0" />

          {/* ── Not Open column ── */}
          <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
            {/* Column header */}
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Layers size={13} style={{ color: 'var(--newtab-text-secondary)' }} className="shrink-0" />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
                Not Open
              </h3>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 font-medium"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                {filteredSaved.length}
              </span>
            </div>

            {filteredSaved.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 gap-2"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                <Layers size={28} className="opacity-25" />
                <p className="text-sm opacity-70">
                  {search ? 'No saved groups match search' : 'All saved groups are currently open'}
                </p>
                <p className="text-xs opacity-40 text-center max-w-[16rem]">
                  {search
                    ? 'Try a different term'
                    : 'Closed groups appear here automatically'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredSaved.map((t) => (
                  <SavedGroupCard
                    key={t.key}
                    template={t}
                    onDelete={handleDeleteTemplate}
                    onRestore={handleRestoreTemplate}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
