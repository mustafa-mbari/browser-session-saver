import { useTheme } from '@shared/hooks/useTheme';
import Header from './components/Header';
import NavigationStack from './components/NavigationStack';

export default function App() {
  useTheme();

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <NavigationStack />
    </div>
  );
}
