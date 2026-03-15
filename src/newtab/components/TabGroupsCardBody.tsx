import { useEffect, useState, useCallback } from 'react';
import { ArrowRight, Layers, RefreshCw } from 'lucide-react';
import type { BookmarkCategory } from '@core/types/newtab.types';
import { useNewTabStore } from '@newtab/stores/newtab.store';

interface LiveGroup {
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
  windowId: number;
  tabCount: number;
}

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

interface Props {
  category: BookmarkCategory;
}

export default function TabGroupsCardBody({ category }: Props) {
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const setActiveView = useNewTabStore((s) => s.setActiveView);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [groups, tabs] = await Promise.all([
        chrome.tabGroups.query({}),
        chrome.tabs.query({}),
      ]);
      const tabCountMap: Record<number, number> = {};
      for (const tab of tabs) {
        if (tab.groupId && tab.groupId > 0) {
          tabCountMap[tab.groupId] = (tabCountMap[tab.groupId] ?? 0) + 1;
        }
      }
      setLiveGroups(
        groups.map((g) => ({
          id: g.id,
          title: g.title || 'Unnamed',
          color: g.color ?? 'grey',
          collapsed: g.collapsed,
          windowId: g.windowId,
          tabCount: tabCountMap[g.id] ?? 0,
        })),
      );
    } catch {
      setLiveGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const colSpan = category.colSpan ?? 1;
  const visibleGroups = liveGroups.slice(0, colSpan === 3 ? 10 : colSpan === 2 ? 6 : 3);
  const totalTabs = liveGroups.reduce((s, g) => s + g.tabCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col px-3 pb-3 gap-2">
      {/* Summary strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 text-xs font-medium"
          style={{ color: 'var(--newtab-text)' }}
        >
          <span>🗂️</span>
          <span>
            {liveGroups.length} group{liveGroups.length !== 1 ? 's' : ''}
          </span>
        </div>
        {liveGroups.length > 0 && (
          <>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/20 text-xs font-medium text-green-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Live</span>
            </div>
            <span
              className="text-[10px] opacity-40"
              style={{ color: 'var(--newtab-text-secondary)' }}
            >
              {totalTabs} tab{totalTabs !== 1 ? 's' : ''}
            </span>
          </>
        )}
        <button
          onClick={() => void loadGroups()}
          className="ml-auto opacity-40 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--newtab-text-secondary)' }}
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Group rows */}
      {visibleGroups.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {visibleGroups.map((g) => {
            const accentColor = GROUP_COLORS[g.color] ?? '#9aa0a6';
            return (
              <div
                key={g.id}
                className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/8 transition-colors"
                style={{ borderLeft: `2px solid ${accentColor}` }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                <span
                  className="flex-1 text-xs truncate"
                  style={{ color: 'var(--newtab-text)' }}
                >
                  {g.title}
                </span>
                <span
                  className="text-[10px] shrink-0 tabular-nums"
                  style={{ color: 'var(--newtab-text-secondary)', opacity: 0.6 }}
                >
                  {g.tabCount}t
                </span>
                {g.collapsed && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded bg-white/10"
                    style={{ color: 'var(--newtab-text-secondary)' }}
                    title="Group is collapsed in browser"
                  >
                    —
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p
          className="text-xs text-center py-2 opacity-50"
          style={{ color: 'var(--newtab-text-secondary)' }}
        >
          No active tab groups
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 mt-0.5 border-t border-white/8">
        <button
          onClick={() => setActiveView('tab-groups')}
          className="flex items-center gap-1 text-[11px] hover:opacity-80 transition-opacity"
          style={{ color: 'var(--newtab-text-secondary)', opacity: 0.45 }}
        >
          Manage <ArrowRight size={10} />
        </button>
        <button
          onClick={() => setActiveView('tab-groups')}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white transition-colors"
        >
          <Layers size={10} /> View All
        </button>
      </div>
    </div>
  );
}
