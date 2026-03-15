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
import { BookmarkBoardContext, type BookmarkBoardActions } from '@newtab/contexts/BookmarkBoardContext';

interface Props extends BookmarkBoardActions {
  board: Board;
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  density: CardDensity;
  onAddCategory: (boardId: string, cardType: CardType) => void;
  onReorderCategories: (newCategories: BookmarkCategory[]) => void;
  onImportNative: (boardId: string) => void;
}

export default function BookmarkBoard({
  board,
  categories,
  entries,
  density,
  onAddCategory,
  onReorderCategories,
  onImportNative,
  // Actions forwarded via context
  onAddEntry,
  onDeleteEntry,
  onRenameEntry,
  onDeleteCategory,
  onToggleCollapse,
  onReorderEntries,
  onResize,
  onUpdateNote,
  onRenameCard,
  onDuplicateCard,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { handleDragEnd } = useSortableCategories(categories, onReorderCategories);
  const [addCardOpen, setAddCardOpen] = useState(false);

  const actions: BookmarkBoardActions = {
    onAddEntry, onDeleteEntry, onRenameEntry, onDeleteCategory,
    onToggleCollapse, onReorderEntries, onResize, onUpdateNote,
    onRenameCard, onDuplicateCard,
  };

  return (
    <BookmarkBoardContext.Provider value={actions}>
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
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(9, 1fr)', gridAutoRows: '60px' }}
              >
                {categories.map((cat) => {
                  const catEntries = entries.filter((e) => e.categoryId === cat.id);
                  return (
                    <BookmarkCategoryCard
                      key={cat.id}
                      category={cat}
                      entries={catEntries}
                      density={density}
                      colSpan={cat.colSpan ?? 3}
                      rowSpan={cat.rowSpan ?? 3}
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
    </BookmarkBoardContext.Provider>
  );
}
