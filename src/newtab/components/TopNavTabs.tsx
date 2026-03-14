import type { NewTabView } from '@newtab/stores/newtab.store';

const TABS: { id: NewTabView; label: string }[] = [
  { id: 'bookmarks', label: 'All Bookmarks' },
  { id: 'frequent', label: 'Frequently Visited' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'activity', label: 'Activity' },
];

interface Props {
  activeView: NewTabView;
  onViewChange: (view: NewTabView) => void;
}

export default function TopNavTabs({ activeView, onViewChange }: Props) {
  return (
    <div className="flex gap-1 justify-center">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onViewChange(tab.id)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tab.id === activeView
              ? 'bg-white/15 text-white'
              : 'text-white/60 hover:text-white/90 hover:bg-white/8'
          }`}
          aria-current={tab.id === activeView ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
