import { useTheme } from '@shared/hooks/useTheme';
import { useDashboardStore } from './stores/dashboard.store';
import Sidebar from './components/Sidebar';
import SessionsPage from './pages/SessionsPage';
import AutoSavesPage from './pages/AutoSavesPage';
import TabGroupsPage from './pages/TabGroupsPage';
import ImportExportPage from './pages/ImportExportPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  useTheme();
  const { activePage } = useDashboardStore();

  return (
    <div className="flex h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {activePage === 'sessions' && <SessionsPage />}
        {activePage === 'auto-saves' && <AutoSavesPage />}
        {activePage === 'tab-groups' && <TabGroupsPage />}
        {activePage === 'import-export' && <ImportExportPage />}
        {activePage === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
