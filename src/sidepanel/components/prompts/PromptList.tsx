import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Star, Clock } from 'lucide-react';
import type { Prompt, PromptTag, PromptCategory, PromptFolder, PromptSortField } from '@core/types/prompt.types';
import { PromptService } from '@core/services/prompt.service';
import PromptCard from './PromptCard';

interface PromptListProps {
  prompts: Prompt[];
  tags: PromptTag[];
  categories: PromptCategory[];
  folders?: PromptFolder[];
  onEdit: (p: Prompt) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCopy: (id: string) => void;
  onUse: (p: Prompt) => void;
}

export default function PromptList({
  prompts,
  tags,
  categories,
  folders = [],
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onCopy,
  onUse,
}: PromptListProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<PromptSortField>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupByCategory, setGroupByCategory] = useState(false);

  const toggleTagFilter = (id: string) => {
    setFilterTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const filtered = useMemo(
    () =>
      PromptService.filterPrompts(prompts, {
        search,
        categoryId: filterCategoryId || undefined,
        tagIds: filterTagIds.length > 0 ? filterTagIds : undefined,
        favoritesOnly,
      }),
    [prompts, search, filterCategoryId, filterTagIds, favoritesOnly],
  );

  const sorted = useMemo(() => PromptService.sortPrompts(filtered, sortBy, sortDir), [filtered, sortBy, sortDir]);

  const recent = useMemo(() => (search ? [] : PromptService.getRecentPrompts(prompts, 5)), [prompts, search]);

  // Group by category if requested
  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, Prompt[]>();
    for (const p of sorted) {
      const key = p.categoryId ?? '__none__';
      const bucket = map.get(key) ?? [];
      bucket.push(p);
      map.set(key, bucket);
    }
    return map;
  }, [sorted, groupByCategory]);

  const hasFilters = filterCategoryId || filterTagIds.length > 0 || favoritesOnly;

  const cycleSort = (field: PromptSortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search + filter toggle */}
      <div className="px-2 pt-2 pb-1 flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`p-1.5 rounded-lg border transition-colors ${
            showFilters || hasFilters
              ? 'border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
          }`}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-2 pb-2 space-y-2 border-b border-[var(--color-border)]">
          {/* Category filter */}
          {categories.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Category</p>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setFilterCategoryId('')}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    !filterCategoryId
                      ? 'bg-amber-500 text-white border-transparent'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-amber-400'
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCategoryId(c.id === filterCategoryId ? '' : c.id)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      filterCategoryId === c.id
                        ? 'text-white border-transparent'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-amber-400'
                    }`}
                    style={filterCategoryId === c.id ? { backgroundColor: c.color } : undefined}
                  >
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tag filter */}
          {tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      filterTagIds.includes(tag.id)
                        ? 'text-white border-transparent'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-amber-400'
                    }`}
                    style={filterTagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options row */}
          <div className="flex items-center flex-wrap gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">Favorites only</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={groupByCategory}
                onChange={(e) => setGroupByCategory(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">Group by category</span>
            </label>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--color-text-secondary)]">Sort:</span>
            {(['updatedAt', 'createdAt', 'title', 'usageCount'] as PromptSortField[]).map((f) => (
              <button
                key={f}
                onClick={() => cycleSort(f)}
                className={`px-2 py-0.5 rounded text-xs transition-colors border ${
                  sortBy === f
                    ? 'border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-amber-300'
                }`}
              >
                {f === 'updatedAt' ? 'Updated' : f === 'createdAt' ? 'Created' : f === 'usageCount' ? 'Used' : 'Title'}
                {sortBy === f && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {/* Recent section (only when no search/filter active) */}
        {recent.length > 0 && !search && !hasFilters && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock size={11} className="text-[var(--color-text-secondary)]" />
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                Recently Used
              </span>
            </div>
            <div className="space-y-1">
              {recent.map((p) => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  tags={tags}
                  categories={categories}
                  folders={folders}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleFavorite={onToggleFavorite}
                  onTogglePin={onTogglePin}
                  onCopy={onCopy}
                  onUse={onUse}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main list */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Star size={28} className="text-[var(--color-text-secondary)] opacity-40 mb-2" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              {search || hasFilters ? 'No prompts match your filters' : 'No prompts yet'}
            </p>
            {!search && !hasFilters && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 opacity-70">
                Click "+ Add Prompt" to get started
              </p>
            )}
          </div>
        ) : grouped ? (
          // Grouped view
          Array.from(grouped.entries()).map(([catId, items]) => {
            const cat = categories.find((c) => c.id === catId);
            return (
              <div key={catId} className="mb-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  {cat ? `${cat.icon} ${cat.name}` : 'Uncategorized'}
                  <span className="font-normal opacity-60">({items.length})</span>
                </p>
                <div className="space-y-1">
                  {items.map((p) => (
                    <PromptCard
                      key={p.id}
                      prompt={p}
                      tags={tags}
                      categories={categories}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggleFavorite={onToggleFavorite}
                      onTogglePin={onTogglePin}
                      onCopy={onCopy}
                      onUse={onUse}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Flat list
          sorted.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              tags={tags}
              categories={categories}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
              onCopy={onCopy}
              onUse={onUse}
            />
          ))
        )}
      </div>
    </div>
  );
}
