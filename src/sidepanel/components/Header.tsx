import { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Sun, Moon, User } from 'lucide-react';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useTheme } from '@shared/hooks/useTheme';
import { isAuthenticated } from '@core/services/auth.service';
import AutoSaveBadge from './AutoSaveBadge';
import type { LimitStatus } from '@core/types/limits.types';

export default function Header() {
  const { currentView, navigationStack, activeNavBarTab, goBack, navigateTo } = useSidePanelStore();
  const { isDark, setTheme } = useTheme();
  const canGoBack = navigationStack.length > 1 || (currentView === 'home' && activeNavBarTab === 'dynamic');
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const load = () => {
      chrome.runtime.sendMessage({ action: 'GET_LIMIT_STATUS', payload: {} }, (r) => {
        void chrome.runtime.lastError;
        if (r?.success && r.data) setLimitStatus(r.data as LimitStatus);
      });
    };
    load();
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.action_usage || changes.cached_plan) load();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    void isAuthenticated().then(setSignedIn);
    const listener = () => { void isAuthenticated().then(setSignedIn); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
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
        {limitStatus && (
          <LimitPill status={limitStatus} />
        )}
        <button
          onClick={() => navigateTo('account')}
          className="relative p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Account"
          title="Account"
        >
          <User size={16} />
          {signedIn && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white dark:border-gray-800" />
          )}
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
    account: 'Account',
  };
  return titles[view] ?? 'Browser Hub';
}

function LimitPill({ status }: { status: LimitStatus }) {
  const pct = status.dailyLimit > 0 ? status.dailyUsed / status.dailyLimit : 0;
  const color = status.dailyBlocked || status.monthlyBlocked
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : pct >= 0.9
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : pct >= 0.7
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${color}`}
      title={`${status.dailyUsed}/${status.dailyLimit} actions today · ${status.monthlyUsed}/${status.monthlyLimit} this month`}
    >
      {status.dailyUsed}/{status.dailyLimit}
    </span>
  );
}
