import { useMemo, useState } from 'react';
import { Layers, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import type { Tab } from '@core/types/session.types';

interface GroupAggregate {
  key: string;
  title: string;
  color: string;
  sessionCount: number;
  totalTabs: number;
  tabs: Tab[];
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
};

function uniqueTabs(tabs: Tab[]): Tab[] {
  const seen = new Set<string>();
  return tabs.filter((tab) => {
    if (seen.has(tab.url)) return false;
    seen.add(tab.url);
    return true;
  });
}

export default function TabGroupsPanel() {
  const { sessions, loading } = useSession();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const groups = useMemo((): GroupAggregate[] => {
    const map = new Map<string, GroupAggregate>();
    for (const session of sessions) {
      for (const group of session.tabGroups) {
        const key = `${group.title}-${group.color}`;
        const groupTabs = session.tabs.filter((t) => t.groupId === group.id);
        const existing = map.get(key);
        if (existing) {
          existing.sessionCount++;
          existing.totalTabs += groupTabs.length;
          existing.tabs.push(...groupTabs);
        } else {
          map.set(key, {
            key,
            title: group.title || 'Unnamed Group',
            color: group.color,
            sessionCount: 1,
            totalTabs: groupTabs.length,
            tabs: [...groupTabs],
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalTabs - a.totalTabs);
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="pt-4 flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
          Tab Groups
        </h2>
        <span className="text-sm" style={{ color: 'var(--newtab-text-secondary)' }}>
          {groups.length} unique group{groups.length !== 1 ? 's' : ''}
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-xl" style={{ color: 'var(--newtab-text-secondary)' }}>
          <Layers size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-base">No tab groups</p>
          <p className="text-sm mt-1 opacity-60">
            Tab groups from saved sessions will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((group) => {
            const isExpanded = expandedGroup === group.key;
            const accentColor = GROUP_COLORS[group.color] ?? '#9aa0a6';
            return (
              <div key={group.key} className="glass-panel rounded-xl overflow-hidden">
                {/* Colored accent bar */}
                <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--newtab-text)' }}>
                      {group.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
                      {group.totalTabs} tab{group.totalTabs !== 1 ? 's' : ''} · {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isExpanded
                    ? <ChevronDown size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
                    : <ChevronRight size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
                  }
                </button>

                {isExpanded && (
                  <div className="border-t border-white/10 max-h-56 overflow-auto px-2 py-1">
                    {uniqueTabs(group.tabs).map((tab) => (
                      <a
                        key={tab.id}
                        href={tab.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/10 transition-colors group"
                      >
                        {tab.favIconUrl ? (
                          <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-sm bg-white/20 shrink-0" />
                        )}
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--newtab-text)' }}>
                          {tab.title || tab.url}
                        </span>
                        <ExternalLink
                          size={10}
                          className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                          style={{ color: 'var(--newtab-text-secondary)' }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
