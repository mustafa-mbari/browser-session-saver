import { ArrowLeft, Settings, Sun, Moon } from 'lucide-react';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useTheme } from '@shared/hooks/useTheme';
import AutoSaveBadge from './AutoSaveBadge';

export default function Header() {
  const { currentView, navigationStack, goBack, navigateTo } = useSidePanelStore();
  const { isDark, setTheme, theme } = useTheme();
  const canGoBack = navigationStack.length > 1;

  const toggleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  return (
    <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2">
        {canGoBack && (
          <button
            onClick={goBack}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        {currentView === 'home' && (
          <img
            src={chrome.runtime.getURL('icons/bs_logo.png')}
            alt="Session Saver"
            className="w-5 h-5 shrink-0"
          />
        )}
        <span className="font-semibold text-sm">
          {currentView === 'home' ? 'Session Saver' : viewTitle(currentView)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AutoSaveBadge />
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => navigateTo('settings')}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

function viewTitle(view: string): string {
  const titles: Record<string, string> = {
    'session-detail': 'Session Details',
    'tab-groups': 'Tab Groups',
    settings: 'Settings',
    'import-export': 'Import / Export',
  };
  return titles[view] ?? 'Session Saver';
}
