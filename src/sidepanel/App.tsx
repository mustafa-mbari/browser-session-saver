import { useTheme } from '@shared/hooks/useTheme';
import { useKeyboard } from '@shared/hooks/useKeyboard';
import { useSidePanelStore } from './stores/sidepanel.store';
import Header from './components/Header';
import NavigationStack from './components/NavigationStack';

export default function App() {
  useTheme();
  const { navigateTo, focusSearch } = useSidePanelStore();

  useKeyboard({
    'Ctrl+Shift+R': () => navigateTo('home'),
    'Ctrl+Shift+D': () => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') }),
    'Ctrl+Shift+F': () => focusSearch?.(),
    'Ctrl+Shift+E': () => navigateTo('import-export'),
    'Ctrl+Shift+S': () => navigateTo('subscriptions'),
  });

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <NavigationStack />
    </div>
  );
}
