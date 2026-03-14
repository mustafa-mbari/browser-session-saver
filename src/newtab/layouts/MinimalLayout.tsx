import { useRef } from 'react';
import { Settings, Paintbrush, LayoutDashboard } from 'lucide-react';
import SearchBar from '@newtab/components/SearchBar';
import ClockWidget from '@newtab/components/ClockWidget';
import { useNewTabStore } from '@newtab/stores/newtab.store';

export default function MinimalLayout() {
  const store = useNewTabStore();
  const { settings } = store;
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative z-10 h-screen flex flex-col items-center justify-center gap-6 px-6">
      {settings.showClock && <ClockWidget clockFormat={settings.clockFormat} />}
      <div className="w-full max-w-xl">
        <SearchBar ref={searchRef} settings={settings} />
      </div>

      {/* Corner controls — dim until hovered */}
      <div className="fixed top-3 right-3 flex items-center gap-1 opacity-20 hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={() => store.setLayoutMode('dashboard')}
          className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          title="Switch to Dashboard layout"
        >
          <LayoutDashboard size={16} style={{ color: 'var(--newtab-text)' }} />
        </button>
        <button
          onClick={() => store.toggleWallpaper()}
          className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          title="Background & Wallpaper"
        >
          <Paintbrush size={16} style={{ color: 'var(--newtab-text)' }} />
        </button>
        <button
          onClick={() => store.toggleSettings()}
          className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          title="Settings"
        >
          <Settings size={16} style={{ color: 'var(--newtab-text)' }} />
        </button>
      </div>
    </div>
  );
}
