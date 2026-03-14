import { forwardRef } from 'react';
import { Paintbrush, Settings, Sun, Moon, Monitor, Clock } from 'lucide-react';
import SearchBar from '@newtab/components/SearchBar';
import { useTheme } from '@shared/hooks/useTheme';
import type { NewTabSettings } from '@core/types/newtab.types';
import type { NewTabView } from '@newtab/stores/newtab.store';

interface Props {
  settings: NewTabSettings;
  activeView: NewTabView;
  onViewChange: (view: NewTabView) => void;
  onOpenSettings: () => void;
  onOpenWallpaper: () => void;
  onToggleClock: () => void;
}

const NAV_TABS: { id: NewTabView; label: string }[] = [
  { id: 'bookmarks', label: 'All Bookmarks' },
  { id: 'frequent', label: 'Frequently Visited' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'activity', label: 'Activity' },
];

const SESSION_VIEWS = new Set(['sessions', 'auto-saves', 'tab-groups', 'import-export']);

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const THEME_CYCLE: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];

const NewTabHeader = forwardRef<HTMLInputElement, Props>(
  ({ settings, activeView, onViewChange, onOpenSettings, onOpenWallpaper, onToggleClock }, searchRef) => {
    const { theme, setTheme } = useTheme();

    const cycleTheme = () => {
      const idx = THEME_CYCLE.indexOf(theme as 'system' | 'light' | 'dark');
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      void setTheme(next);
    };

    const ThemeIcon = THEME_ICONS[theme as keyof typeof THEME_ICONS] ?? Monitor;
    const isSessionView = SESSION_VIEWS.has(activeView);

    return (
      <header className="glass-dark shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-white/10">
        {/* Branding */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            S
          </div>
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--newtab-text)' }}>
            Session Saver
          </span>
        </div>

        {/* Nav tabs — hidden in session management views */}
        {!isSessionView && (
          <div className="flex items-center gap-0.5 pl-3 shrink-0">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  tab.id === activeView
                    ? 'bg-white/15 text-white'
                    : 'text-white/55 hover:text-white/85 hover:bg-white/8'
                }`}
                aria-current={tab.id === activeView ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Search — grows to fill remaining space */}
        <div className="flex-1 max-w-xl mx-auto">
          <SearchBar ref={searchRef} settings={settings} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Clock toggle */}
          <button
            onClick={onToggleClock}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            aria-label={settings.showClock ? 'Hide clock' : 'Show clock'}
            title={settings.showClock ? 'Hide clock' : 'Show clock'}
          >
            <Clock
              size={16}
              style={{ color: settings.showClock ? 'var(--newtab-text)' : 'rgba(255,255,255,0.3)' }}
            />
          </button>

          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            aria-label={`Theme: ${theme}. Click to cycle`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon size={16} style={{ color: 'var(--newtab-text)' }} />
          </button>

          {/* Wallpaper */}
          <button
            onClick={onOpenWallpaper}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            aria-label="Change background"
            title="Background & Wallpaper"
          >
            <Paintbrush size={16} style={{ color: 'var(--newtab-text)' }} />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={16} style={{ color: 'var(--newtab-text)' }} />
          </button>
        </div>
      </header>
    );
  },
);

NewTabHeader.displayName = 'NewTabHeader';
export default NewTabHeader;
