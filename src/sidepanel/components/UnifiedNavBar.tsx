import { useSidePanelStore, type HomeTab } from '../stores/sidepanel.store';
import type { SidePanelView } from '../stores/sidepanel.store';

type NavTab =
  | { kind: 'home'; key: HomeTab; label: string }
  | { kind: 'view'; key: Extract<SidePanelView, 'prompts' | 'subscriptions'>; label: string };

const NAV_TABS: NavTab[] = [
  { kind: 'home', key: 'session',       label: 'Sessions'      },
  { kind: 'home', key: 'tab',           label: 'Tabs'          },
  { kind: 'home', key: 'tab-group',     label: 'Groups'        },
  { kind: 'home', key: 'bookmarks',     label: 'Bookmarks'     },
  { kind: 'view', key: 'prompts',       label: 'Prompts'       },
  { kind: 'view', key: 'subscriptions', label: 'Subscriptions' },
];

const VISIBLE_VIEWS = new Set<SidePanelView>(['home', 'prompts', 'subscriptions']);

export default function UnifiedNavBar() {
  const { currentView, activeHomeTab, navigateTo, setActiveHomeTab } = useSidePanelStore();

  if (!VISIBLE_VIEWS.has(currentView)) return null;

  const handleClick = (tab: NavTab) => {
    if (tab.kind === 'home') {
      navigateTo('home');
      setActiveHomeTab(tab.key);
    } else {
      navigateTo(tab.key);
    }
  };

  const isActive = (tab: NavTab): boolean => {
    if (tab.kind === 'home') {
      return currentView === 'home' && activeHomeTab === tab.key;
    }
    return currentView === tab.key;
  };

  return (
    <nav aria-label="Main navigation" className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div role="tablist" className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {NAV_TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => handleClick(tab)}
              className={`flex-shrink-0 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]'
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
