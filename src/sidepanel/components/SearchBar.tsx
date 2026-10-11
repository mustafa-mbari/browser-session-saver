import { useRef, useEffect, useMemo } from 'react';
import { Search, ArrowDownUp } from 'lucide-react';
import { useSidePanelStore, type FilterType, type SortField } from '../stores/sidepanel.store';
import { debounce } from '@core/utils/debounce';

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

  const debouncedSearch = useMemo(() => debounce(onSearch, 200), [onSearch]);

  useEffect(() => {
    setFocusSearch(() => inputRef.current?.focus());
    return () => setFocusSearch(null);
  }, [setFocusSearch]);

  return (
    <div className="px-3 py-1.5 border-b border-(--color-border)">
      <div className="relative flex items-center gap-1">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--color-text-secondary) pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="flex-1 pl-8 pr-2 py-1.5 text-sm rounded-btn bg-(--color-bg-secondary) border border-(--color-border) text-(--color-text) placeholder-(--color-text-secondary) focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent"
          onChange={(e) => debouncedSearch(e.target.value)}
          aria-label="Search"
        />
        {showFilters && (
          <>
            <select
              value={activeFilter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="shrink-0 text-xs bg-(--color-bg-secondary) border border-(--color-border) rounded-btn px-1.5 py-1.5 text-(--color-text-secondary) cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-primary"
              aria-label="Filter sessions"
            >
              {filters.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSort(e.target.value as SortField)}
              className="shrink-0 text-xs bg-transparent text-(--color-text-secondary) border-none cursor-pointer focus:outline-hidden"
              aria-label="Sort sessions"
            >
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <ArrowDownUp size={12} className="shrink-0 text-(--color-text-secondary)" />
          </>
        )}
      </div>
    </div>
  );
}
