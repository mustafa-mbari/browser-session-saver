import { useState, useEffect } from 'react';
import { useTheme } from '@shared/hooks/useTheme';
import { useKeyboard } from '@shared/hooks/useKeyboard';
import { useSidePanelStore } from './stores/sidepanel.store';
import Header from './components/Header';
import UnifiedNavBar from './components/UnifiedNavBar';
import NavigationStack from './components/NavigationStack';
import OnboardingModal, { useOnboardingFlag } from '@shared/components/OnboardingModal';
import LimitReachedModal from '@shared/components/LimitReachedModal';
import type { LimitStatus } from '@core/types/limits.types';
import { ActionLimitError } from '@core/services/limits/limit-guard';

export default function App() {
  useTheme();
  const { navigateTo, focusSearch, openPageFromMenu } = useSidePanelStore();
  const { needsOnboarding, markComplete } = useOnboardingFlag();
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);

  // Show modal when any guarded action is blocked (via message response or direct throw)
  useEffect(() => {
    const onLimitReached = (e: Event) => {
      setLimitStatus((e as CustomEvent<LimitStatus>).detail);
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof ActionLimitError) {
        e.preventDefault();
        setLimitStatus(e.reason.status);
      }
    };
    window.addEventListener('limit-reached', onLimitReached);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('limit-reached', onLimitReached);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useKeyboard({
    'Ctrl+Shift+R': () => navigateTo('home'),
    'Ctrl+Shift+F': () => focusSearch?.(),
    'Ctrl+Shift+E': () => navigateTo('import-export'),
    'Ctrl+Shift+B': () => openPageFromMenu('subscriptions'),
    'Ctrl+Shift+P': () => openPageFromMenu('prompts'),
  });

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <UnifiedNavBar />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <NavigationStack />
      </div>
      <OnboardingModal
        isOpen={needsOnboarding === true}
        onClose={() => void markComplete()}
      />
      {limitStatus && (
        <LimitReachedModal status={limitStatus} onClose={() => setLimitStatus(null)} />
      )}
    </div>
  );
}
