import { useRef, useEffect } from 'react';
import { Search, ArrowDownUp } from 'lucide-react';
import { useSidePanelStore, type FilterType, type SortField } from '../stores/sidepanel.store';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  showFilters?: boolean;
}

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'manual', label: 'Manual' },
  { key: 'auto', label: 'Auto' },
  { key: 'starred', label: 'Starred' },
  { key: 'pinned', label: 'Pinned' },
];

const sorts: { key: SortField; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Name' },
  { key: 'tabs', label: 'Tabs' },
];

export default function SearchBar({ onSearch, placeholder = 'Search sessions... (#tag to filter)', showFilters = true }: SearchBarProps) {
  const { activeFilter, setFilter, sortBy, setSort, setFocusSearch } = useSidePanelStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFocusSearch(() => inputRef.current?.focus());
    return () => setFocusSearch(null);
  }, [setFocusSearch]);

  return (
    <div className={`px-3 py-2 border-b border-[var(--color-border)] ${showFilters ? 'space-y-2' : ''}`}>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-btn bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search"
        />
      </div>

      {showFilters && (
        <div className="flex items-center gap-1 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                activeFilter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}

          <div className="ml-auto flex items-center">
            <select
              value={sortBy}
              onChange={(e) => setSort(e.target.value as SortField)}
              className="text-xs bg-transparent text-[var(--color-text-secondary)] border-none cursor-pointer focus:outline-none"
              aria-label="Sort sessions"
            >
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ArrowDownUp size={12} className="text-[var(--color-text-secondary)]" />
          </div>
        </div>
      )}
    </div>
  );
}
