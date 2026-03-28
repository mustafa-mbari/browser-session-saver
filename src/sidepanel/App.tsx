import { useTheme } from '@shared/hooks/useTheme';
import { useKeyboard } from '@shared/hooks/useKeyboard';
import { useSidePanelStore } from './stores/sidepanel.store';
import Header from './components/Header';
import UnifiedNavBar from './components/UnifiedNavBar';
import NavigationStack from './components/NavigationStack';

export default function App() {
  useTheme();
  const { navigateTo, focusSearch, setActiveHomeTab } = useSidePanelStore();

  useKeyboard({
    'Ctrl+Shift+R': () => navigateTo('home'),
    'Ctrl+Shift+F': () => focusSearch?.(),
    'Ctrl+Shift+E': () => navigateTo('import-export'),
    'Ctrl+Shift+B': () => { navigateTo('home'); setActiveHomeTab('subscriptions'); },
    'Ctrl+Shift+P': () => { navigateTo('home'); setActiveHomeTab('prompts'); },
  });

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <UnifiedNavBar />
      <NavigationStack />
    </div>
  );
}
