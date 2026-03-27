import { ArrowLeft, Settings, Sun, Moon, CreditCard, Sparkles, Cloud } from 'lucide-react';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useTheme } from '@shared/hooks/useTheme';
import AutoSaveBadge from './AutoSaveBadge';

export default function Header() {
  const { currentView, navigationStack, goBack, navigateTo } = useSidePanelStore();
  const { isDark, setTheme } = useTheme();
  const canGoBack = navigationStack.length > 1;

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
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
            src={chrome.runtime.getURL('icons/browser-hub_logo.png')}
            alt="Browser Hub"
            className="w-5 h-5 shrink-0"
          />
        )}
        <span className="font-semibold text-sm">
          {currentView === 'home' ? 'Browser Hub' : viewTitle(currentView)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AutoSaveBadge />
        <button
          onClick={() => navigateTo('prompts')}
          className={`p-1.5 rounded transition-colors ${
            currentView === 'prompts'
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          aria-label="Prompt Manager"
          title="Prompt Manager (Ctrl+Shift+P)"
        >
          <Sparkles size={16} />
        </button>
        <button
          onClick={() => navigateTo('subscriptions')}
          className={`p-1.5 rounded transition-colors ${
            currentView === 'subscriptions'
              ? 'text-violet-500 bg-violet-50 dark:bg-violet-900/20'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          aria-label="Subscriptions"
          title="Subscriptions (Ctrl+Shift+S)"
        >
          <CreditCard size={16} />
        </button>
        <button
          onClick={() => navigateTo('cloud-sync')}
          className={`p-1.5 rounded transition-colors ${
            currentView === 'cloud-sync'
              ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/20'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          aria-label="Cloud Sync"
          title="Cloud Sync"
        >
          <Cloud size={16} />
        </button>
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
    subscriptions: 'Subscriptions',
    prompts: 'Prompt Manager',
    'cloud-sync': 'Cloud Sync',
  };
  return titles[view] ?? 'Browser Hub';
}
