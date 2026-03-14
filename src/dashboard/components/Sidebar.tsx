import { FolderOpen, Clock, Layers, ArrowLeftRight, Settings } from 'lucide-react';
import { useDashboardStore, type DashboardPage } from '../stores/dashboard.store';

const navItems: { key: DashboardPage; label: string; icon: typeof FolderOpen }[] = [
  { key: 'sessions', label: 'Sessions', icon: FolderOpen },
  { key: 'auto-saves', label: 'Auto-Saves', icon: Clock },
  { key: 'tab-groups', label: 'Tab Groups', icon: Layers },
  { key: 'import-export', label: 'Import / Export', icon: ArrowLeftRight },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { activePage, setPage } = useDashboardStore();

  return (
    <aside className="w-56 h-screen bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col">
      <div className="px-4 py-4">
        <h1 className="text-lg font-semibold">Session Saver</h1>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Dashboard</p>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-btn text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-[var(--color-text)] hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-secondary)]">v1.0.0</p>
      </div>
    </aside>
  );
}
