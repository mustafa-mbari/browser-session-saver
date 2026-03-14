import { forwardRef, type KeyboardEvent, useState } from 'react';
import { Search } from 'lucide-react';
import { SEARCH_ENGINE_URLS, type NewTabSettings } from '@core/types/newtab.types';

interface Props {
  settings: NewTabSettings;
}

function isUrl(value: string): boolean {
  try {
    const u = new URL(value.includes('://') ? value : `https://${value}`);
    return u.hostname.includes('.');
  } catch (_) {
    return false;
  }
}

const SearchBar = forwardRef<HTMLInputElement, Props>(({ settings }, ref) => {
  const [query, setQuery] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !query.trim()) return;
    const q = query.trim();
    if (isUrl(q)) {
      const url = q.includes('://') ? q : `https://${q}`;
      window.location.href = url;
    } else {
      const baseUrl =
        settings.searchEngine === 'custom'
          ? (settings.customSearchUrl ?? SEARCH_ENGINE_URLS.google)
          : SEARCH_ENGINE_URLS[settings.searchEngine];
      window.location.href = `${baseUrl}${encodeURIComponent(q)}`;
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="glass-panel rounded-3xl flex items-center px-5 py-3 gap-3 shadow-lg">
        <Search size={20} className="shrink-0 opacity-60" style={{ color: 'var(--newtab-text)' }} />
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search the web or enter a URL…"
          className="flex-1 bg-transparent outline-none text-lg placeholder-white/40"
          style={{ color: 'var(--newtab-text)' }}
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
