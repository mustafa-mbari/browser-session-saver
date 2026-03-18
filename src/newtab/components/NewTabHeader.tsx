import { forwardRef, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const langBtnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const currentLang = settings.language ?? 'auto';

    const openDropdown = () => {
      if (langBtnRef.current) {
        const rect = langBtnRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
      setLangOpen((o) => !o);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      if (!langOpen) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        const insideBtn = langBtnRef.current?.contains(target);
        const insideMenu = dropdownRef.current?.contains(target);
        if (!insideBtn && !insideMenu) setLangOpen(false);
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
          <img src="/icons/browser-hub_logo.png" alt="Browser Hub" className="w-6 h-6 rounded-md" />
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--newtab-text)' }}>
            Browser Hub
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
          <button
            ref={langBtnRef}
            onClick={openDropdown}
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
          {langOpen && createPortal(
            <div
              ref={dropdownRef}
              className="glass-panel rounded-xl py-1 min-w-[130px]"
              style={{
                position: 'fixed',
                top: dropdownPos.top,
                right: dropdownPos.right,
                zIndex: 99999,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
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
            </div>,
            document.body,
          )}

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
