import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { LayoutGrid, Download } from 'lucide-react';
import BookmarkCategoryCard from './BookmarkCategoryCard';
import AddCardModal from './AddCardModal';
import type {
  Board,
  BookmarkCategory,
  BookmarkEntry,
  CardDensity,
  CardType,
} from '@core/types/newtab.types';
import { useSortableCategories } from '@newtab/hooks/useBookmarkDnd';

interface Props {
  board: Board;
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  density: CardDensity;
  onAddCategory: (boardId: string, cardType: CardType) => void;
  onDeleteCategory: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
  onReorderCategories: (newCategories: BookmarkCategory[]) => void;
  onReorderEntries: (categoryId: string, orderedIds: string[]) => void;
  onImportNative: (boardId: string) => void;
  onResizeCategory: (id: string, colSpan: 1 | 2 | 3, rowSpan: 1 | 2 | 3) => void;
  onUpdateNote?: (id: string, content: string) => void;
  onRenameCard: (id: string, name: string) => void;
  onDuplicateCard: (id: string) => void;
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
  onResizeCategory,
  onUpdateNote,
  onRenameCard,
  onDuplicateCard,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { handleDragEnd } = useSortableCategories(categories, onReorderCategories);
  const [addCardOpen, setAddCardOpen] = useState(false);

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
            onClick={() => setAddCardOpen(true)}
            className="glass flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors"
            style={{ color: 'var(--newtab-text)' }}
            aria-label="Add Card"
          >
            <LayoutGrid size={14} />
            Add Card
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 opacity-50" style={{ color: 'var(--newtab-text)' }}>
          No cards yet. Add a card or import your bookmarks.
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'minmax(180px, auto)' }}
            >
              {categories.map((cat) => {
                const catEntries = entries.filter((e) => e.categoryId === cat.id);
                return (
                  <BookmarkCategoryCard
                    key={cat.id}
                    category={cat}
                    entries={catEntries}
                    density={density}
                    colSpan={cat.colSpan ?? 1}
                    rowSpan={cat.rowSpan ?? 1}
                    onAddEntry={onAddEntry}
                    onDeleteEntry={onDeleteEntry}
                    onDeleteCategory={onDeleteCategory}
                    onToggleCollapse={onToggleCollapse}
                    onReorderEntries={onReorderEntries}
                    onResize={onResizeCategory}
                    onUpdateNote={onUpdateNote}
                    onRenameCard={onRenameCard}
                    onDuplicateCard={onDuplicateCard}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddCardModal
        isOpen={addCardOpen}
        boardId={board.id}
        onClose={() => setAddCardOpen(false)}
        onAdd={(boardId, cardType) => { onAddCategory(boardId, cardType); }}
      />
    </div>
  );
}
