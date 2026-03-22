import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { LayoutGrid, Download, FolderOpen, Save } from 'lucide-react';
import { useNewTabUIStore } from '@newtab/stores/newtab-ui.store';
import BookmarkCategoryCard from './BookmarkCategoryCard';
import AddCardModal from './AddCardModal';
import type {
  Board,
  BookmarkCategory,
  BookmarkEntry,
  CardDensity,
  CardType,
} from '@core/types/newtab.types';
import { WIDGET_CONFIG, clampSize } from '@core/config/widget-config';
import { useSortableCategories } from '@newtab/hooks/useBookmarkDnd';
import { BookmarkBoardContext, type BookmarkBoardActions } from '@newtab/contexts/BookmarkBoardContext';

interface Props extends BookmarkBoardActions {
  board: Board;
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  density: CardDensity;
  isMain?: boolean;
  onAddCategory: (boardId: string, cardType: CardType) => void;
  onReorderCategories: (newCategories: BookmarkCategory[]) => void;
  onImportNative: (boardId: string) => void;
  hasUnsavedLayoutChanges?: boolean;
  savedFeedback?: boolean;
  onSaveLayout?: () => void;
}

export default function BookmarkBoard({
  board,
  categories,
  entries,
  density,
  isMain = false,
  onAddCategory,
  onReorderCategories,
  onImportNative,
  hasUnsavedLayoutChanges,
  savedFeedback,
  onSaveLayout,
  // Actions forwarded via context
  onAddEntry,
  onDeleteEntry,
  onRenameEntry,
  onDeleteCategory,
  onToggleCollapse,
  onReorderEntries,
  onResize,
  onUpdateNote,
  onRefreshQuote,
  onRenameCard,
  onDuplicateCard,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { handleDragEnd } = useSortableCategories(categories, onReorderCategories);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const setActiveView = useNewTabUIStore((s) => s.setActiveView);

  const actions: BookmarkBoardActions = {
    onAddEntry, onDeleteEntry, onRenameEntry, onDeleteCategory,
    onToggleCollapse, onReorderEntries, onResize, onUpdateNote,
    onRefreshQuote, onRenameCard, onDuplicateCard,
  };

  return (
    <BookmarkBoardContext.Provider value={actions}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>
            {board.icon} {board.name}
          </h2>
          <div className="flex gap-2">
            {!isMain && (
              <button
                onClick={() => onImportNative(board.id)}
                className="glass flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors"
                style={{ color: 'var(--newtab-text)' }}
              >
                <Download size={14} />
                Import Bookmarks
              </button>
            )}
            <button
              onClick={() => setActiveView('folder-explorer')}
              className="glass flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
              aria-label="Bookmarks Folders"
            >
              <FolderOpen size={14} />
              Folders
            </button>
            {hasUnsavedLayoutChanges && onSaveLayout && (
              <button
                onClick={onSaveLayout}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                style={{
                  color: savedFeedback ? '#86efac' : '#fbbf24',
                  backgroundColor: savedFeedback ? 'rgba(134,239,172,0.12)' : 'rgba(251,191,36,0.15)',
                  borderColor: savedFeedback ? 'rgba(134,239,172,0.3)' : 'rgba(251,191,36,0.3)',
                }}
                aria-label={savedFeedback ? 'Layout saved' : 'Save layout changes'}
                title={savedFeedback ? 'Layout saved' : 'Save layout changes'}
              >
                <Save size={14} />
                {savedFeedback ? 'Saved!' : 'Save Layout changes'}
              </button>
            )}
            <button
              onClick={() => setAddCardOpen(true)}
              className="glass flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
              aria-label="Add Widget"
            >
              <LayoutGrid size={14} />
              Add Widget
            </button>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-12 opacity-50" style={{ color: 'var(--newtab-text)' }}>
            No widgets yet. Add a widget or import your bookmarks.
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(9, 1fr)', gridAutoRows: '60px' }}
              >
                {categories.map((cat) => {
                  const cardType = cat.cardType ?? 'bookmark';
                  const cfg = WIDGET_CONFIG[cardType];
                  const { colSpan, rowSpan } = clampSize(
                    cardType,
                    cat.colSpan ?? cfg.defaultW,
                    cat.rowSpan ?? cfg.defaultH,
                  );
                  const catEntries = entries.filter((e) => e.categoryId === cat.id);
                  return (
                    <BookmarkCategoryCard
                      key={cat.id}
                      category={cat}
                      entries={catEntries}
                      density={density}
                      colSpan={colSpan}
                      rowSpan={rowSpan}
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
