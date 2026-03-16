import { useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus } from 'lucide-react';
import type { BookmarkCategory, BookmarkEntry, CardDensity, SpanValue } from '@core/types/newtab.types';
import { useSortableItems } from '@newtab/hooks/useBookmarkDnd';
import BookmarkEntryRow from '@newtab/components/BookmarkEntryRow';

interface BookmarkCardBodyProps {
  category: BookmarkCategory;
  entries: BookmarkEntry[];
  density: CardDensity;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
  onRenameEntry: (id: string, title: string, url: string) => void;
  onReorderEntries: (categoryId: string, orderedIds: string[]) => void;
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function BookmarkCardBody({
  category, entries, density, onAddEntry, onDeleteEntry, onRenameEntry, onReorderEntries, rowSpan,
}: BookmarkCardBodyProps) {
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const rowHeight = density === 'compact' ? 28 : 38;

  const { handleDragEnd } = useSortableItems(entries, (reordered) => {
    onReorderEntries(category.id, reordered.map((e) => e.id));
  });

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const handleAddSubmit = () => {
    if (!addUrl.trim()) return;
    onAddEntry(category.id, addTitle.trim() || addUrl, addUrl.trim());
    setAddUrl('');
    setAddTitle('');
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col px-1 pb-1">
      {entries.length > 30 ? (
        <div ref={scrollRef} style={{ height: Math.min(entries.length * rowHeight, Math.max(80, rowSpan * 60 - 60)), overflow: 'auto' }}>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((vItem) => (
                  <div
                    key={vItem.key}
                    style={{ position: 'absolute', top: vItem.start, height: vItem.size, width: '100%' }}
                  >
                    <BookmarkEntryRow entry={entries[vItem.index]} density={density} onDelete={onDeleteEntry} onRename={onRenameEntry} />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            {entries.map((entry) => (
              <BookmarkEntryRow key={entry.id} entry={entry} density={density} onDelete={onDeleteEntry} onRename={onRenameEntry} />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {showAdd ? (
        <div className="flex flex-col gap-1 mt-1 px-1">
          <input
            type="text"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="URL"
            className="bg-white/10 rounded px-2 py-1 text-xs outline-none placeholder-white/30"
            style={{ color: 'var(--newtab-text)' }}
            autoFocus
          />
          <input
            type="text"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Title (optional)"
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit()}
            className="bg-white/10 rounded px-2 py-1 text-xs outline-none placeholder-white/30"
            style={{ color: 'var(--newtab-text)' }}
          />
          <div className="flex gap-1">
            <button
              onClick={handleAddSubmit}
              className="flex-1 text-xs py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
            >
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs px-2 py-1 hover:bg-white/10 rounded transition-colors"
              style={{ color: 'var(--newtab-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 mt-1 px-2 py-1 rounded hover:bg-white/10 transition-colors opacity-50 hover:opacity-100"
          aria-label="Add bookmark"
        >
          <Plus size={12} style={{ color: 'var(--newtab-text)' }} />
          <span className="text-xs" style={{ color: 'var(--newtab-text)' }}>Add Bookmark</span>
        </button>
      )}
    </div>
  );
}
