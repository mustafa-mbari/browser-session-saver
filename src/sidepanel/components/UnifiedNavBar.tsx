import { useSidePanelStore, type HomeTab } from '../stores/sidepanel.store';
import type { SidePanelView } from '../stores/sidepanel.store';

interface NavTab {
  key: HomeTab;
  label: string;
}

const NAV_TABS: NavTab[] = [
  { key: 'session',       label: 'Sessions'      },
  { key: 'tab',           label: 'Tabs'          },
  { key: 'tab-group',     label: 'Groups'        },
  { key: 'bookmarks',     label: 'Bookmarks'     },
  { key: 'prompts',       label: 'Prompts'       },
  { key: 'subscriptions', label: 'Subscriptions' },
];

const VISIBLE_VIEWS = new Set<SidePanelView>(['home']);

export default function UnifiedNavBar() {
  const { currentView, activeHomeTab, navigateTo, setActiveHomeTab } = useSidePanelStore();

  if (!VISIBLE_VIEWS.has(currentView)) return null;

  const handleClick = (tab: NavTab) => {
    navigateTo('home');
    setActiveHomeTab(tab.key);
  };

  return (
    <nav aria-label="Main navigation" className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div role="tablist" className="flex overflow-x-auto px-2 py-1.5 gap-0.5" style={{ scrollbarWidth: 'none' }}>
        {NAV_TABS.map((tab) => {
          const active = currentView === 'home' && activeHomeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => handleClick(tab)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                active
                  ? 'bg-[var(--color-bg-selected)] text-primary'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
