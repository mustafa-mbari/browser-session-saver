import { useRef } from 'react';
import SearchBar from '@newtab/components/SearchBar';
import ClockWidget from '@newtab/components/ClockWidget';
import { useNewTabStore } from '@newtab/stores/newtab.store';

export default function MinimalLayout() {
  const { settings } = useNewTabStore();
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative z-10 h-screen flex flex-col items-center justify-center gap-6 px-6">
      {settings.showClock && <ClockWidget clockFormat={settings.clockFormat} />}
      <div className="w-full">
        <SearchBar ref={searchRef} settings={settings} />
      </div>
    </div>
  );
}
