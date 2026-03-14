import type { TabGroup } from '@core/types/session.types';
import Tooltip from '@shared/components/Tooltip';

const colorMap: Record<string, string> = {
  grey: 'bg-[var(--group-grey)]',
  blue: 'bg-[var(--group-blue)]',
  red: 'bg-[var(--group-red)]',
  yellow: 'bg-[var(--group-yellow)]',
  green: 'bg-[var(--group-green)]',
  pink: 'bg-[var(--group-pink)]',
  purple: 'bg-[var(--group-purple)]',
  cyan: 'bg-[var(--group-cyan)]',
  orange: 'bg-[var(--group-orange)]',
};

interface TabGroupPreviewProps {
  groups: TabGroup[];
  maxVisible?: number;
}

export default function TabGroupPreview({ groups, maxVisible = 5 }: TabGroupPreviewProps) {
  if (groups.length === 0) return null;

  const visible = groups.slice(0, maxVisible);
  const remaining = groups.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      {visible.map((group) => (
        <Tooltip key={group.id} content={group.title || group.color}>
          <span
            className={`w-2.5 h-2.5 rounded-full ${colorMap[group.color] ?? 'bg-gray-400'}`}
          />
        </Tooltip>
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-[var(--color-text-secondary)]">+{remaining}</span>
      )}
    </div>
  );
}
