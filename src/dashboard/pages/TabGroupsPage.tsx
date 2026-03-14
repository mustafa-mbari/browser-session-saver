import { useMemo, useState } from 'react';
import { Layers, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import type { Tab } from '@core/types/session.types';
import EmptyState from '@shared/components/EmptyState';
import LoadingSpinner from '@shared/components/LoadingSpinner';

interface GroupAggregate {
  key: string;
  title: string;
  color: string;
  sessionCount: number;
  totalTabs: number;
  tabs: Tab[];
}

export default function TabGroupsPage() {
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
            title: group.title || 'Unnamed group',
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

  if (loading) return <LoadingSpinner size="lg" />;

  if (groups.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Tab Groups</h2>
        <EmptyState
          icon={Layers}
          title="No tab groups"
          description="Tab groups from your saved sessions will appear here."
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-2">Tab Groups</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {groups.length} unique group{groups.length !== 1 ? 's' : ''} across {sessions.length} sessions
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.key;
          return (
            <div
              key={group.key}
              className="rounded-card border border-[var(--color-border)] overflow-hidden"
            >
              <button
                onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: `var(--group-${group.color})` }}
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{group.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {group.totalTabs} tab{group.totalTabs !== 1 ? 's' : ''} · {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''}
                  </p>
                </div>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--color-border)] max-h-60 overflow-auto">
                  {uniqueTabs(group.tabs).map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center gap-2 px-4 py-1.5 hover:bg-[var(--color-bg-secondary)] transition-colors group"
                    >
                      {tab.favIconUrl ? (
                        <img src={tab.favIconUrl} alt="" className="w-3.5 h-3.5 rounded-sm" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-sm bg-gray-200 dark:bg-gray-600" />
                      )}
                      <span className="text-xs truncate flex-1">{tab.title || tab.url}</span>
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink size={10} className="text-[var(--color-text-secondary)]" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function uniqueTabs(tabs: Tab[]): Tab[] {
  const seen = new Set<string>();
  return tabs.filter((tab) => {
    if (seen.has(tab.url)) return false;
    seen.add(tab.url);
    return true;
  });
}
