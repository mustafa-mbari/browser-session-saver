import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Monitor,
  XCircle,
  MoreVertical,
  RotateCcw,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import type { ChromeGroupColor } from '@core/types/session.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import EmptyState from '@shared/components/EmptyState';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import ContextMenu from '@shared/components/ContextMenu';
import { GROUP_COLORS as GROUP_COLOR_MAP, COLOR_OPTIONS } from '@core/constants/tab-group-colors';

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

/** Restore a template's tabs as a new group in the current browser window. */
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

function LiveGroupRow({ group, onRefresh }: { group: LiveGroup; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(group.title);
  const [draftColor, setDraftColor] = useState<ChromeGroupColor>(group.color);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accentColor = GROUP_COLOR_MAP[group.color] ?? '#9aa0a6';
  const templateKey = `${group.title}-${group.color}`;

  useEffect(() => {
    TabGroupTemplateStorage.getAll().then((all) => {
      setBookmarked(all.some((t) => t.key === templateKey));
    });
  }, [templateKey]);

  const startEdit = useCallback(() => {
    setDraftTitle(group.title);
    setDraftColor(group.color);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [group.title, group.color]);

  const saveEdit = useCallback(async () => {
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
  }, [group.id, group.title, draftTitle, draftColor, onRefresh]);

  const handleUngroup = useCallback(async () => {
    const tabIds = group.tabs.map((t) => t.id!).filter(Boolean);
    if (tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
      onRefresh();
    }
  }, [group.tabs, onRefresh]);

  const handleCloseFromBrowser = useCallback(async () => {
    setClosing(true);
    try {
      const now = new Date().toISOString();
      await TabGroupTemplateStorage.upsert({
        key: `${group.title}-${group.color}`,
        title: group.title,
        color: group.color,
        tabs: group.tabs.map((t) => ({
          url: t.url ?? '',
          title: t.title ?? '',
          favIconUrl: t.favIconUrl ?? '',
        })),
        savedAt: now,
        updatedAt: now,
      });
      const tabIds = group.tabs.map((t) => t.id!).filter(Boolean);
      if (tabIds.length > 0) await chrome.tabs.remove(tabIds);
      onRefresh();
    } finally {
      setClosing(false);
    }
  }, [group, onRefresh]);

  const handleFocusGroup = useCallback(async () => {
    const firstTab = group.tabs[0];
    if (firstTab?.id) {
      await chrome.windows.update(group.windowId, { focused: true });
      await chrome.tabs.update(firstTab.id, { active: true });
    }
  }, [group.tabs, group.windowId]);

  const toggleCollapse = useCallback(async () => {
    await chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
    onRefresh();
  }, [group.id, group.collapsed, onRefresh]);

  const handleSaveAsTemplate = useCallback(async () => {
    setBookmarking(true);
    try {
      const now = new Date().toISOString();
      await TabGroupTemplateStorage.upsert({
        key: templateKey,
        title: group.title,
        color: group.color,
        tabs: group.tabs.map((t) => ({
          url: t.url ?? '',
          title: t.title ?? '',
          favIconUrl: t.favIconUrl ?? '',
        })),
        savedAt: now,
        updatedAt: now,
      });
      setBookmarked(true);
      onRefresh();
    } finally {
      setBookmarking(false);
    }
  }, [group, templateKey, onRefresh]);

  const menuItems = useMemo(() => [
    { label: 'Rename',             icon: Edit2,     onClick: startEdit },
    { label: 'Restore Here',       icon: Monitor,   onClick: () => void handleFocusGroup() },
    { label: 'Close from browser', icon: XCircle,   onClick: () => void handleCloseFromBrowser() },
    { label: 'Ungroup',            icon: Trash2,    onClick: () => void handleUngroup(), danger: true },
  ], [startEdit, handleFocusGroup, handleCloseFromBrowser, handleUngroup]);

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />

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
                  if (e.key === 'Escape') { setEditing(false); setDraftTitle(group.title); }
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
                onClick={() => { setEditing(false); setDraftTitle(group.title); }}
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
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
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

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {group.tabs.length}t
              </span>
              {group.collapsed && (
                <button
                  onClick={(e) => { e.stopPropagation(); void toggleCollapse(); }}
                  className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-bg-secondary)] hover:opacity-80"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Click to expand in browser"
                >
                  collapsed
                </button>
              )}
              {(closing || saving || bookmarking) ? (
                <span className="w-6 h-6 flex items-center justify-center">
                  <span
                    className="w-3 h-3 border border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-text-secondary)' }}
                  />
                </span>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleSaveAsTemplate(); }}
                    title={bookmarked ? 'Saved — syncs across devices' : 'Save as template'}
                    className="p-1 rounded transition-colors"
                    style={{ color: bookmarked ? '#34c759' : 'var(--color-text-secondary)' }}
                  >
                    {bookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                  </button>
                  <ContextMenu items={menuItems}>
                    <button
                      className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      aria-label="More actions"
                    >
                      <MoreVertical size={13} />
                    </button>
                  </ContextMenu>
                </>
              )}
            </div>
          </div>
        )}
      </div>

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

function SavedGroupRow({
  template,
  onRestore,
  onDelete,
  onRename,
}: {
  template: TabGroupTemplate;
  onRestore: (t: TabGroupTemplate) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onRename: (key: string, newTitle: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(template.title);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accentColor = GROUP_COLOR_MAP[template.color] ?? '#9aa0a6';

  const startEdit = useCallback(() => {
    setDraftTitle(template.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [template.title]);

  const saveRename = useCallback(async () => {
    const newTitle = draftTitle.trim();
    if (!newTitle || newTitle === template.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(template.key, newTitle);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [draftTitle, template.title, template.key, onRename]);

  const menuItems = useMemo(() => [
    {
      label: 'Restore',
      icon: RotateCcw,
      onClick: () => {
        setRestoring(true);
        void onRestore(template).finally(() => setRestoring(false));
      },
    },
    {
      label: 'Rename',
      icon: Edit2,
      onClick: startEdit,
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => {
        setDeleting(true);
        void onDelete(template.key);
      },
      danger: true,
    },
  ], [template, onRestore, onDelete, startEdit]);

  return (
    <div
      className="border border-[var(--color-border)] rounded-lg overflow-hidden transition-opacity"
      style={{ opacity: deleting ? 0.4 : 1 }}
    >
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />

      <div className="px-3 py-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              placeholder="Group name"
              className="flex-1 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text)] outline-none focus:border-blue-500"
            />
            <button
              onClick={() => void saveRename()}
              disabled={saving}
              className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center gap-1 text-left min-w-0"
            >
              <span className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>
                {template.title || 'Unnamed group'}
              </span>
              {expanded
                ? <ChevronDown size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {template.tabs.length}t
              </span>
              {(restoring || saving || deleting) ? (
                <span className="w-6 h-6 flex items-center justify-center">
                  <span
                    className="w-3 h-3 border border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-text-secondary)' }}
                  />
                </span>
              ) : (
                <ContextMenu items={menuItems}>
                  <button
                    className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                    aria-label="More actions"
                  >
                    <MoreVertical size={13} />
                  </button>
                </ContextMenu>
              )}
            </div>
          </div>
        )}
      </div>

      {expanded && !editing && (
        <div className="border-t border-[var(--color-border)] max-h-40 overflow-auto">
          {template.tabs.slice(0, 20).map((tab, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-sm bg-white/10 shrink-0" />
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                {tab.title || tab.url || 'Unknown'}
              </span>
            </div>
          ))}
          {template.tabs.length > 20 && (
            <p className="text-xs text-center py-1 opacity-40" style={{ color: 'var(--color-text-secondary)' }}>
              +{template.tabs.length - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export default function TabGroupsView() {
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

      // Auto-save live groups to template storage (skip groups with no Chrome title —
      // they are reset-on-restart groups whose real names will be restored by the
      // startup handler; saving them now would create junk "Unnamed-blue" entries).
      const now = new Date().toISOString();
      const groupTitleById = new Map(groups.map((g) => [g.id, g.title ?? '']));
      await Promise.all(
        live
          .filter((g) => g.tabs.length > 0 && groupTitleById.get(g.id) !== '')
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

  // Saved tab: only groups NOT currently live
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

  const handleRenameTemplate = useCallback(
    async (key: string, newTitle: string) => {
      const all = await TabGroupTemplateStorage.getAll();
      const existing = all.find((t) => t.key === key);
      if (!existing) return;
      const newKey = `${newTitle}-${existing.color}`;
      await TabGroupTemplateStorage.upsert({ ...existing, key: newKey, title: newTitle });
      if (newKey !== key) await TabGroupTemplateStorage.delete(key);
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
          title="Create a new tab group"
        >
          <Plus size={12} /> New
        </button>
      </div>

      {/* Split content: Live section / Saved section */}
      <div className="flex-1 overflow-auto flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center pt-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* ── Live section ── */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                  Live
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium ml-0.5"
                >
                  {filteredLive.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                {filteredLive.length === 0 ? (
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
                    <LiveGroupRow key={g.id} group={g} onRefresh={() => void loadLiveGroups()} />
                  ))
                )}
              </div>
            </div>

            {/* Section divider */}
            <div className="border-t-2 border-[var(--color-border)]" />

            {/* ── Not Open section ── */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60">
                <Layers size={11} style={{ color: 'var(--color-text-secondary)' }} className="shrink-0" />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                  Not Open
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 font-medium ml-0.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {filteredSaved.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                {filteredSaved.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title={search ? 'No matching saved groups' : 'All saved groups are currently open'}
                    description={
                      search
                        ? 'Try a different search term.'
                        : 'Groups that are closed will appear here automatically.'
                    }
                  />
                ) : (
                  filteredSaved.map((t) => (
                    <SavedGroupRow
                      key={t.key}
                      template={t}
                      onRestore={handleRestoreTemplate}
                      onDelete={handleDeleteTemplate}
                      onRename={handleRenameTemplate}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
