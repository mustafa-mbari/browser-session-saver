import { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Sun, Moon, Cloud } from 'lucide-react';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useTheme } from '@shared/hooks/useTheme';
import AutoSaveBadge from './AutoSaveBadge';

export default function Header() {
  const { currentView, navigationStack, activeNavBarTab, goBack, navigateTo } = useSidePanelStore();
  const { isDark, setTheme } = useTheme();
  const canGoBack = navigationStack.length > 1 || (currentView === 'home' && activeNavBarTab === 'dynamic');
  const [syncSignedIn, setSyncSignedIn] = useState(false);

  useEffect(() => {
    const load = () => {
      chrome.storage.local.get('cloud_sync_status', (r) => {
        const s = r['cloud_sync_status'] as { isAuthenticated?: boolean } | undefined;
        setSyncSignedIn(s?.isAuthenticated ?? false);
      });
    };
    load();
    chrome.storage.onChanged.addListener(load);
    return () => chrome.storage.onChanged.removeListener(load);
  }, []);

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
          onClick={() => navigateTo('cloud-sync')}
          className={`relative p-1.5 rounded transition-colors ${
            currentView === 'cloud-sync'
              ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/20'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          aria-label="Cloud Sync"
          title={syncSignedIn ? 'Cloud Sync (signed in)' : 'Cloud Sync (sign in)'}
        >
          <Cloud size={16} />
          <span className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
            syncSignedIn ? 'bg-emerald-400' : 'bg-amber-400'
          }`} style={{ border: '1.5px solid white' }} />
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
