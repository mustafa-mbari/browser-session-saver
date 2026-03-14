import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import ContextMenu from '@shared/components/ContextMenu';
import type { BookmarkCategory, BookmarkEntry, CardDensity } from '@core/types/newtab.types';
import { useSortableItems } from '@newtab/hooks/useBookmarkDnd';
import { getFaviconUrl, getFaviconInitial } from '@core/utils/favicon';

interface EntryRowProps {
  entry: BookmarkEntry;
  density: CardDensity;
  onDelete: (id: string) => void;
}

function BookmarkEntryRow({ entry, density, onDelete }: EntryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });
  const [imgFailed, setImgFailed] = useState(false);

  const rowH = density === 'compact' ? 'py-1' : 'py-1.5';
  const iconCls = density === 'compact' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs';
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm';

  const menuItems = [
    { label: 'Open', onClick: () => window.open(entry.url, '_blank') },
    { label: 'Delete', onClick: () => onDelete(entry.id), danger: true },
  ];

  return (
    <ContextMenu items={menuItems}>
      <div
        ref={setNodeRef}
        style={{
          transform: transform ? CSS.Transform.toString(transform) : undefined,
          transition,
          opacity: isDragging ? 0.5 : 1,
        }}
        {...attributes}
        {...listeners}
        className={`flex items-center gap-2 ${rowH} px-2 rounded hover:bg-white/10 cursor-pointer group`}
        onClick={() => window.open(entry.url, '_self')}
      >
        {!imgFailed ? (
          <img
            src={entry.favIconUrl || getFaviconUrl(entry.url)}
            alt=""
            className={`${iconCls} rounded shrink-0`}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span
            className={`${iconCls} flex items-center justify-center rounded bg-white/20 font-bold shrink-0`}
            style={{ color: 'var(--newtab-text)' }}
          >
            {getFaviconInitial(entry.title, entry.url)}
          </span>
        )}
        <span className={`flex-1 truncate ${textSize}`} style={{ color: 'var(--newtab-text)' }}>
          {entry.title || entry.url}
        </span>
      </div>
    </ContextMenu>
  );
}

interface Props {
  category: BookmarkCategory;
  entries: BookmarkEntry[];
  density: CardDensity;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onReorderEntries: (categoryId: string, orderedIds: string[]) => void;
}

export default function BookmarkCategoryCard({
  category,
  entries,
  density,
  onAddEntry,
  onDeleteEntry,
  onDeleteCategory,
  onToggleCollapse,
  onReorderEntries,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { handleDragEnd } = useSortableItems(entries, (reordered) => {
    onReorderEntries(category.id, reordered.map((e) => e.id));
  });

  const rowHeight = density === 'compact' ? 28 : 38;
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const menuItems = [
    { label: 'Delete Category', onClick: () => onDeleteCategory(category.id), danger: true },
  ];

  const handleAddSubmit = () => {
    if (!addUrl.trim()) return;
    onAddEntry(category.id, addTitle.trim() || addUrl, addUrl.trim());
    setAddUrl('');
    setAddTitle('');
    setShowAdd(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="glass-panel rounded-xl overflow-hidden flex flex-col"
    >
      {/* Colored left accent bar */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: category.color }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => onToggleCollapse(category.id)}
        {...attributes}
        {...listeners}
      >
        <span className="text-base">{category.icon}</span>
        <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--newtab-text)' }}>
          {category.name}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full bg-white/10"
          style={{ color: 'var(--newtab-text-secondary)' }}
        >
          {entries.length}
        </span>
        {category.collapsed ? (
          <ChevronRight size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
        )}
        <ContextMenu items={menuItems}>
          <button
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
            onClick={(e) => e.stopPropagation()}
            aria-label="Category options"
          >
            <MoreHorizontal size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
        </ContextMenu>
      </div>

      {/* Entry list */}
      {!category.collapsed && (
        <div className="flex flex-col px-1 pb-1">
          {entries.length > 30 ? (
            <div
              ref={scrollRef}
              style={{ height: Math.min(entries.length * rowHeight, 320), overflow: 'auto' }}
            >
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={entries.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((vItem) => (
                      <div
                        key={vItem.key}
                        style={{
                          position: 'absolute',
                          top: vItem.start,
                          height: vItem.size,
                          width: '100%',
                        }}
                      >
                        <BookmarkEntryRow
                          entry={entries[vItem.index]}
                          density={density}
                          onDelete={onDeleteEntry}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={entries.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                {entries.map((entry) => (
                  <BookmarkEntryRow
                    key={entry.id}
                    entry={entry}
                    density={density}
                    onDelete={onDeleteEntry}
                  />
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
              <span className="text-xs" style={{ color: 'var(--newtab-text)' }}>
                Add Bookmark
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
