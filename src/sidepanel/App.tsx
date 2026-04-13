import { useState, useCallback } from 'react';
import { useTheme } from '@shared/hooks/useTheme';
import { useKeyboard } from '@shared/hooks/useKeyboard';
import { useSidePanelStore } from './stores/sidepanel.store';
import Header from './components/Header';
import UnifiedNavBar from './components/UnifiedNavBar';
import NavigationStack from './components/NavigationStack';
import QuickActions from './components/QuickActions';
import Toast, { type ToastData } from '@shared/components/Toast';
import OnboardingModal, { useOnboardingFlag } from '@shared/components/OnboardingModal';
import { generateId } from '@core/utils/uuid';

export default function App() {
  useTheme();
  const { navigateTo, focusSearch, openPageFromMenu } = useSidePanelStore();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const { needsOnboarding, markComplete } = useOnboardingFlag();

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: generateId() }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
      <div className="flex-1 overflow-hidden">
        <NavigationStack />
      </div>
      <QuickActions onToast={addToast} />
      <OnboardingModal
        isOpen={needsOnboarding === true}
        onClose={() => void markComplete()}
      />
      {/* Global Toast Container */}
      <div className="fixed bottom-16 left-2 right-2 z-50 space-y-2 pointer-events-none">
        <div className="pointer-events-auto space-y-2">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </div>
    </div>
  );
}
