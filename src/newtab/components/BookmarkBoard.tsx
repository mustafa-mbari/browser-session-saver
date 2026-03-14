import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { FolderPlus, Download } from 'lucide-react';
import BookmarkCategoryCard from './BookmarkCategoryCard';
import type {
  Board,
  BookmarkCategory,
  BookmarkEntry,
  CardDensity,
} from '@core/types/newtab.types';
import { useSortableCategories } from '@newtab/hooks/useBookmarkDnd';

interface Props {
  board: Board;
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  density: CardDensity;
  onAddCategory: (boardId: string) => void;
  onDeleteCategory: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
  onReorderCategories: (newCategories: BookmarkCategory[]) => void;
  onReorderEntries: (categoryId: string, orderedIds: string[]) => void;
  onImportNative: (boardId: string) => void;
}

export default function BookmarkBoard({
  board,
  categories,
  entries,
  density,
  onAddCategory,
  onDeleteCategory,
  onToggleCollapse,
  onAddEntry,
  onDeleteEntry,
  onReorderCategories,
  onReorderEntries,
  onImportNative,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { handleDragEnd } = useSortableCategories(categories, onReorderCategories);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
          {board.icon} {board.name}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => onImportNative(board.id)}
            className="glass flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors"
            style={{ color: 'var(--newtab-text)' }}
          >
            <Download size={14} />
            Import Bookmarks
          </button>
          <button
            onClick={() => onAddCategory(board.id)}
            className="glass flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors"
            style={{ color: 'var(--newtab-text)' }}
          >
            <FolderPlus size={14} />
            New Category
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 opacity-50" style={{ color: 'var(--newtab-text)' }}>
          No categories yet. Create one or import your bookmarks.
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            >
              {categories.map((cat) => {
                const catEntries = entries.filter((e) => e.categoryId === cat.id);
                return (
                  <BookmarkCategoryCard
                    key={cat.id}
                    category={cat}
                    entries={catEntries}
                    density={density}
                    onAddEntry={onAddEntry}
                    onDeleteEntry={onDeleteEntry}
                    onDeleteCategory={onDeleteCategory}
                    onToggleCollapse={onToggleCollapse}
                    onReorderEntries={onReorderEntries}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
