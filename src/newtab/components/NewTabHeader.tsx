import { forwardRef } from 'react';
import { Paintbrush, Settings, Sun, Moon, Monitor } from 'lucide-react';
import SearchBar from '@newtab/components/SearchBar';
import ClockWidget from '@newtab/components/ClockWidget';
import { useTheme } from '@shared/hooks/useTheme';
import type { NewTabSettings } from '@core/types/newtab.types';

interface Props {
  settings: NewTabSettings;
  onOpenSettings: () => void;
  onOpenWallpaper: () => void;
}

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const THEME_CYCLE: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];

const NewTabHeader = forwardRef<HTMLInputElement, Props>(
  ({ settings, onOpenSettings, onOpenWallpaper }, searchRef) => {
    const { theme, setTheme } = useTheme();

    const cycleTheme = () => {
      const idx = THEME_CYCLE.indexOf(theme as 'system' | 'light' | 'dark');
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      void setTheme(next);
    };

    const ThemeIcon = THEME_ICONS[theme as keyof typeof THEME_ICONS] ?? Monitor;

    return (
      <header className="glass-dark shrink-0 flex items-center gap-3 px-5 py-3 border-b border-white/10">
        {/* Branding */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-[180px]">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            S
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
            Session Saver
          </span>
        </div>

        {/* Clock */}
        {settings.showClock && (
          <div
            className="text-lg font-light shrink-0 select-none"
            style={{ color: 'var(--newtab-text)', textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}
          >
            <ClockWidget clockFormat={settings.clockFormat} />
          </div>
        )}

        {/* Search — grows to fill remaining space */}
        <div className="flex-1 max-w-2xl mx-auto">
          <SearchBar ref={searchRef} settings={settings} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            className="p-2 rounded-lg hover:bg-white/15 transition-colors"
            aria-label={`Theme: ${theme}. Click to cycle`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon size={16} style={{ color: 'var(--newtab-text)' }} />
          </button>

          {/* Wallpaper */}
          <button
            onClick={onOpenWallpaper}
            className="p-2 rounded-lg hover:bg-white/15 transition-colors"
            aria-label="Change background"
            title="Background & Wallpaper"
          >
            <Paintbrush size={16} style={{ color: 'var(--newtab-text)' }} />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg hover:bg-white/15 transition-colors"
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
