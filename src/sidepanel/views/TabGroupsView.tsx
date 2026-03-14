import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import type { TabGroup } from '@core/types/session.types';
import EmptyState from '@shared/components/EmptyState';
import LoadingSpinner from '@shared/components/LoadingSpinner';

interface GroupInfo {
  group: TabGroup;
  sessionCount: number;
  totalTabs: number;
}

export default function TabGroupsView() {
  const { sessions, loading } = useSession();

  const groups = useMemo((): GroupInfo[] => {
    const groupMap = new Map<string, GroupInfo>();

    for (const session of sessions) {
      for (const group of session.tabGroups) {
        const key = `${group.title}-${group.color}`;
        const existing = groupMap.get(key);
        if (existing) {
          existing.sessionCount++;
          existing.totalTabs += group.tabIds.length;
        } else {
          groupMap.set(key, {
            group,
            sessionCount: 1,
            totalTabs: group.tabIds.length,
          });
        }
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [sessions]);

  if (loading) return <LoadingSpinner />;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No tab groups"
        description="Tab groups from your saved sessions will appear here."
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {groups.map((info, index) => (
        <div
          key={`${info.group.title}-${info.group.color}-${index}`}
          className="px-3 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: `var(--group-${info.group.color})` }}
            />
            <span className="font-medium text-sm truncate">
              {info.group.title || 'Unnamed group'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 ml-5 text-xs text-[var(--color-text-secondary)]">
            <span>
              {info.totalTabs} tab{info.totalTabs !== 1 ? 's' : ''}
            </span>
            <span>
              {info.sessionCount} session{info.sessionCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
