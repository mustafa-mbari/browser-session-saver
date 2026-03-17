import { forwardRef, useState, useRef, useEffect } from 'react';
import { Paintbrush, Settings, Sun, Moon, Monitor, Clock, Globe } from 'lucide-react';
import SearchBar from '@newtab/components/SearchBar';
import { useTheme } from '@shared/hooks/useTheme';
import type { AppLanguage, NewTabSettings } from '@core/types/newtab.types';

interface Props {
  settings: NewTabSettings;
  onOpenSettings: () => void;
  onOpenWallpaper: () => void;
  onToggleClock: () => void;
  onLanguageChange: (lang: AppLanguage) => void;
}

const LANG_OPTIONS: { value: AppLanguage; label: string; native: string }[] = [
  { value: 'auto', label: 'Auto',    native: '🌐' },
  { value: 'en',   label: 'English', native: 'EN' },
  { value: 'ar',   label: 'Arabic',  native: 'AR' },
  { value: 'de',   label: 'German',  native: 'DE' },
];

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const THEME_CYCLE: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];

const NewTabHeader = forwardRef<HTMLInputElement, Props>(
  ({ settings, onOpenSettings, onOpenWallpaper, onToggleClock, onLanguageChange }, searchRef) => {
    const { theme, setTheme } = useTheme();
    const [langOpen, setLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);
    const currentLang = settings.language ?? 'auto';

    // Close dropdown when clicking outside
    useEffect(() => {
      if (!langOpen) return;
      const handler = (e: MouseEvent) => {
        if (langRef.current && !langRef.current.contains(e.target as Node)) {
          setLangOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [langOpen]);

    const cycleTheme = () => {
      const idx = THEME_CYCLE.indexOf(theme as 'system' | 'light' | 'dark');
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      void setTheme(next);
    };

    const ThemeIcon = THEME_ICONS[theme as keyof typeof THEME_ICONS] ?? Monitor;

    return (
      <header className="glass-dark shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-white/10">
        {/* Branding */}
        <div className="flex items-center gap-2 shrink-0">
          <img src="/icons/bs_logo.png" alt="Session Saver" className="w-6 h-6 rounded-md" />
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--newtab-text)' }}>
            Session Saver
          </span>
        </div>

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

          {/* Language switcher */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors flex items-center gap-1"
              aria-label="Change language"
              title={`Language: ${currentLang}`}
            >
              <Globe size={16} style={{ color: 'var(--newtab-text)' }} />
              {currentLang !== 'auto' && (
                <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--newtab-text)' }}>
                  {currentLang}
                </span>
              )}
            </button>
            {langOpen && (
              <div
                className="absolute right-0 top-full mt-1 glass-panel rounded-xl py-1 z-[9999] min-w-[130px]"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setLangOpen(false);
                      if (opt.value !== currentLang) onLanguageChange(opt.value);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-white/10"
                    style={{
                      color: opt.value === currentLang ? '#818cf8' : 'var(--newtab-text)',
                      fontWeight: opt.value === currentLang ? 600 : 400,
                    }}
                  >
                    <span className="text-base w-5 text-center">{opt.native}</span>
                    {opt.label}
                    {opt.value === currentLang && (
                      <span className="ml-auto text-xs" style={{ color: '#818cf8' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

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
