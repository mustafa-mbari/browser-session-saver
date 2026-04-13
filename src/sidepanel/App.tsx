import { useTheme } from '@shared/hooks/useTheme';
import { useKeyboard } from '@shared/hooks/useKeyboard';
import { useSidePanelStore } from './stores/sidepanel.store';
import Header from './components/Header';
import UnifiedNavBar from './components/UnifiedNavBar';
import NavigationStack from './components/NavigationStack';
import OnboardingModal, { useOnboardingFlag } from '@shared/components/OnboardingModal';

export default function App() {
  useTheme();
  const { navigateTo, focusSearch, openPageFromMenu } = useSidePanelStore();
  const { needsOnboarding, markComplete } = useOnboardingFlag();

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
    </div>
  );
}
