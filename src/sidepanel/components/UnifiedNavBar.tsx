import { LayoutGrid, Plus, MoreHorizontal } from 'lucide-react';
import { useSidePanelStore } from '../stores/sidepanel.store';
import type { SidePanelView } from '../stores/sidepanel.store';
import { MENU_CARDS } from './MenuGrid';

const VISIBLE_VIEWS = new Set<SidePanelView>(['home']);

export default function UnifiedNavBar() {
  const { currentView, activeNavBarTab, lastOpenedPage, setActiveNavBarTab } = useSidePanelStore();

  if (!VISIBLE_VIEWS.has(currentView)) return null;

  const dynamicCard = lastOpenedPage ? MENU_CARDS.find((c) => c.key === lastOpenedPage) : null;
  const DynamicIcon = dynamicCard?.icon ?? MoreHorizontal;
  const dynamicLabel = dynamicCard?.label ?? '...';
  const hasDynamic = lastOpenedPage !== null;

  const handleNewTab = () => {
    chrome.tabs.create({ url: 'chrome://newtab' });
  };

  return (
    <nav aria-label="Main navigation" className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div role="tablist" className="grid grid-cols-3 px-2 py-1.5 gap-1">
        {/* Menu tab */}
        <button
          role="tab"
          aria-selected={activeNavBarTab === 'menu'}
          onClick={() => setActiveNavBarTab('menu')}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
            activeNavBarTab === 'menu'
              ? 'bg-[var(--color-bg-selected)] text-primary'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
          }`}
        >
          <LayoutGrid size={14} />
          <span>Menu</span>
        </button>

        {/* New Tab action button */}
        <button
          role="tab"
          aria-selected={false}
          onClick={handleNewTab}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <Plus size={14} />
          <span>New Tab</span>
        </button>

        {/* Dynamic tab */}
        <button
          role="tab"
          aria-selected={activeNavBarTab === 'dynamic'}
          onClick={() => hasDynamic && setActiveNavBarTab('dynamic')}
          disabled={!hasDynamic}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
            !hasDynamic
              ? 'text-[var(--color-text-secondary)] opacity-40 cursor-default'
              : activeNavBarTab === 'dynamic'
                ? 'bg-[var(--color-bg-selected)] text-primary'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
          }`}
        >
          <DynamicIcon size={14} />
          <span className="truncate">{dynamicLabel}</span>
        </button>
      </div>
    </nav>
  );
}
