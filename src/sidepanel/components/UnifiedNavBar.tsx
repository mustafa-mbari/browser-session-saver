import { LayoutGrid, Plus, PanelRight } from 'lucide-react';
import { useSidePanelStore } from '../stores/sidepanel.store';
import type { SidePanelView } from '../stores/sidepanel.store';
import { MENU_CARDS } from './MenuGrid';

const VISIBLE_VIEWS = new Set<SidePanelView>(['home']);

export default function UnifiedNavBar() {
  const { currentView, activeNavBarTab, lastOpenedPage, setActiveNavBarTab } = useSidePanelStore();

  if (!VISIBLE_VIEWS.has(currentView)) return null;

  const dynamicCard = lastOpenedPage ? MENU_CARDS.find((c) => c.key === lastOpenedPage) : null;
  const DynamicIcon = dynamicCard?.icon ?? PanelRight;
  const dynamicLabel = dynamicCard?.label ?? 'Page';
  const hasDynamic = lastOpenedPage !== null;

  const handleNewTab = () => {
    chrome.tabs.create({ url: 'chrome://newtab' });
  };

  return (
    <nav aria-label="Main navigation" className="px-3 pt-2 pb-1 bg-[var(--color-bg)]">
      <div role="tablist" className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        {/* Menu tab */}
        <button
          role="tab"
          aria-selected={activeNavBarTab === 'menu'}
          onClick={() => setActiveNavBarTab('menu')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeNavBarTab === 'menu'
              ? 'bg-primary text-white shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
          }`}
        >
          <LayoutGrid size={14} />
          <span>Menu</span>
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-[var(--color-border)] shrink-0" />

        {/* New Tab action button */}
        <button
          role="tab"
          aria-selected={false}
          onClick={handleNewTab}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus size={14} />
          <span>New Tab</span>
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-[var(--color-border)] shrink-0" />

        {/* Dynamic tab */}
        <button
          role="tab"
          aria-selected={activeNavBarTab === 'dynamic'}
          onClick={() => hasDynamic && setActiveNavBarTab('dynamic')}
          disabled={!hasDynamic}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            !hasDynamic
              ? 'text-[var(--color-text-secondary)] opacity-30 cursor-default'
              : activeNavBarTab === 'dynamic'
                ? 'bg-primary text-white shadow-sm'
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
