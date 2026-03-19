import { useState, useCallback, useEffect } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import type { ToastData } from '@shared/components/Toast';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import type { Session, ChromeGroupColor } from '@core/types/session.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import HomeLiveGroupRow, { type TGLiveGroup } from './HomeLiveGroupRow';
import HomeSavedGroupRow from './HomeSavedGroupRow';

interface HomeTabGroupsPanelProps {
  sessions: Session[];
  loading: boolean;
  query: string;
  onToast: (toast: Omit<ToastData, 'id'>) => void;
}

export default function HomeTabGroupsPanel({ query, onToast }: HomeTabGroupsPanelProps) {
  const q = query.toLowerCase();
  const [liveGroups, setLiveGroups] = useState<TGLiveGroup[]>([]);
  const [templates, setTemplates] = useState<TabGroupTemplate[]>([]);
  const [panelLoading, setPanelLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPanelLoading(true);
    try {
      const [groups, tabs, allTemplates] = await Promise.all([
        chrome.tabGroups.query({}),
        chrome.tabs.query({}),
        TabGroupTemplateStorage.getAll(),
      ]);
      const tabsByGroup = new Map<number, chrome.tabs.Tab[]>();
      for (const tab of tabs) {
        if (tab.groupId && tab.groupId > 0) {
          const arr = tabsByGroup.get(tab.groupId) ?? [];
          arr.push(tab);
          tabsByGroup.set(tab.groupId, arr);
        }
      }
      const live: TGLiveGroup[] = groups.map((g) => ({
        id: g.id,
        title: g.title || 'Unnamed',
        color: (g.color as ChromeGroupColor) ?? 'grey',
        collapsed: g.collapsed,
        windowId: g.windowId,
        tabs: tabsByGroup.get(g.id) ?? [],
      }));
      setLiveGroups(live);
      setTemplates(allTemplates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

      // Auto-save live groups (skip groups with no Chrome title)
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
              tabs: g.tabs.map((t) => ({ url: t.url ?? '', title: t.title ?? '', favIconUrl: t.favIconUrl ?? '' })),
              savedAt: now,
              updatedAt: now,
            }),
          ),
      );
    } catch { /* ignore */ } finally {
      setPanelLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const liveKeys = new Set(liveGroups.map((g) => `${g.title}-${g.color}`));
  const offlineTemplates = templates.filter((t) => !liveKeys.has(t.key));

  const filteredLive = liveGroups.filter((g) => !q || g.title.toLowerCase().includes(q));
  const filteredSaved = offlineTemplates.filter((t) => !q || t.title.toLowerCase().includes(q));

  const handleRestoreTemplate = useCallback(async (template: TabGroupTemplate) => {
    const currentWindow = await chrome.windows.getCurrent();
    const windowId = currentWindow.id!;
    const tabIds: number[] = [];
    for (const tab of template.tabs) {
      const created = await chrome.tabs.create({ url: tab.url, windowId, active: false });
      if (created.id) tabIds.push(created.id);
    }
    if (tabIds.length > 0) {
      const gid = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      await chrome.tabGroups.update(gid, { title: template.title, color: template.color });
      await chrome.tabs.update(tabIds[0], { active: true });
    }
    await refresh();
  }, [refresh]);

  const handleDeleteTemplate = useCallback(async (key: string) => {
    await TabGroupTemplateStorage.delete(key);
    setTemplates((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const handleRenameTemplate = useCallback(async (key: string, newTitle: string) => {
    const all = await TabGroupTemplateStorage.getAll();
    const existing = all.find((t) => t.key === key);
    if (!existing) return;
    const newKey = `${newTitle}-${existing.color}`;
    await TabGroupTemplateStorage.upsert({ ...existing, key: newKey, title: newTitle });
    if (newKey !== key) await TabGroupTemplateStorage.delete(key);
    const updated = await TabGroupTemplateStorage.getAll();
    setTemplates(updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);

  if (panelLoading) {
    return <div className="flex items-center justify-center pt-8"><LoadingSpinner /></div>;
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Refresh button */}
      <div className="flex justify-end px-3 pt-1 pb-0.5">
        <button
          onClick={() => void refresh()}
          className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Refresh groups"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* ── Live section ── */}
      <div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text)' }}>Live</span>
          <span className="text-[10px] px-1 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">{filteredLive.length}</span>
        </div>
        {filteredLive.length === 0 ? (
          <p className="text-xs px-3 py-3" style={{ color: 'var(--color-text-secondary)' }}>
            {q ? 'No matching live groups.' : 'No active tab groups in browser.'}
          </p>
        ) : (
          filteredLive.map((g) => (
            <HomeLiveGroupRow key={g.id} group={g} onRefresh={refresh} onToast={onToast} />
          ))
        )}
      </div>

      {/* Section divider */}
      <div className="border-t-2 border-[var(--color-border)]" />

      {/* ── Not Open section ── */}
      <div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60">
          <Layers size={11} style={{ color: 'var(--color-text-secondary)' }} className="shrink-0" />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text)' }}>Not Open</span>
          <span className="text-[10px] px-1 py-0.5 rounded-full bg-white/10 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {filteredSaved.length}
          </span>
        </div>
        {filteredSaved.length === 0 ? (
          <p className="text-xs px-3 py-3" style={{ color: 'var(--color-text-secondary)' }}>
            {q ? 'No matching saved groups.' : 'All saved groups are currently open.'}
          </p>
        ) : (
          filteredSaved.map((t) => (
            <HomeSavedGroupRow
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
  );
}
