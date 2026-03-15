import { useRef, useState, useMemo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, Columns2, Copy, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import ContextMenu from '@shared/components/ContextMenu';
import type { BookmarkCategory, BookmarkEntry, CardDensity, SpanValue } from '@core/types/newtab.types';
import { useNewTabStore } from '@newtab/stores/newtab.store';
import { useBookmarkBoardActions } from '@newtab/contexts/BookmarkBoardContext';
import BookmarkCardBody from '@newtab/components/BookmarkCardBody';
import NoteCardBody from '@newtab/components/NoteCardBody';
import TodoCardBody from '@newtab/components/TodoCardBody';
import ResizePopover from '@newtab/components/ResizePopover';
import ClockWidget from '@newtab/components/ClockWidget';
import SubscriptionCardBody from '@newtab/components/SubscriptionCardBody';
import TabGroupsCardBody from '@newtab/components/TabGroupsCardBody';

interface Props {
  category: BookmarkCategory;
  entries: BookmarkEntry[];
  density: CardDensity;
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function BookmarkCategoryCard({
  category,
  entries,
  density,
  colSpan,
  rowSpan,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const { settings } = useNewTabStore();
  const {
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
  } = useBookmarkBoardActions();

  const cardType = category.cardType ?? 'bookmark';

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(category.name);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [resizeAnchor, setResizeAnchor] = useState<DOMRect | null>(null);
  const resizeBtnRef = useRef<HTMLButtonElement>(null);

  const commitRename = useCallback(() => {
    const name = draftName.trim() || category.name;
    onRenameCard(category.id, name);
    setIsRenaming(false);
  }, [draftName, category.id, category.name, onRenameCard]);

  const openResize = useCallback(() => {
    if (resizeBtnRef.current) {
      setResizeAnchor(resizeBtnRef.current.getBoundingClientRect());
      setResizeOpen(true);
    }
  }, []);

  const badge = useMemo(() => {
    if (cardType === 'bookmark') return `${entries.length}`;
    if (cardType === 'todo') {
      try {
        const items = JSON.parse(category.noteContent || '[]') as { done: boolean }[];
        return `${items.filter((i) => i.done).length}/${items.length}`;
      } catch { return '0/0'; }
    }
    return null;
  }, [cardType, entries.length, category.noteContent]);

  const menuItems = [
    { label: 'Rename',    icon: Pencil, onClick: () => { setDraftName(category.name); setIsRenaming(true); } },
    { label: 'Duplicate', icon: Copy,   onClick: () => onDuplicateCard(category.id) },
    { label: 'Delete Card', icon: Trash2, onClick: () => onDeleteCategory(category.id), danger: true },
  ];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition,
        opacity: isDragging ? 0.6 : 1,
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
      }}
      className="glass-panel rounded-xl overflow-hidden flex flex-col"
    >
      {/* Colored top accent bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: category.color }} />

      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1.5" {...attributes}>
        <div
          className="p-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors shrink-0"
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }} />
        </div>

        <span className="text-base shrink-0">{category.icon}</span>

        {isRenaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { commitRename(); }
              if (e.key === 'Escape') { setDraftName(category.name); setIsRenaming(false); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-white/10 rounded px-1.5 py-0.5 text-sm font-semibold outline-none"
            style={{ color: 'var(--newtab-text)' }}
          />
        ) : (
          <button
            className="flex-1 min-w-0 text-left text-sm font-semibold truncate py-0.5"
            style={{ color: 'var(--newtab-text)' }}
            onClick={() => onToggleCollapse(category.id)}
          >
            {category.name}
          </button>
        )}

        {badge !== null && !isRenaming && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 shrink-0" style={{ color: 'var(--newtab-text-secondary)' }}>
            {badge}
          </span>
        )}

        {!isRenaming && (
          <button onClick={() => onToggleCollapse(category.id)} className="shrink-0 p-0.5">
            {category.collapsed
              ? <ChevronRight size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
              : <ChevronDown  size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
            }
          </button>
        )}

        <button
          ref={resizeBtnRef}
          onClick={openResize}
          className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
          aria-label="Resize card"
          title={`${colSpan}w × ${rowSpan}h`}
        >
          <Columns2 size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
        </button>

        <ContextMenu items={menuItems}>
          <button
            className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
            aria-label="Card options"
          >
            <MoreHorizontal size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
        </ContextMenu>
      </div>

      {resizeOpen && resizeAnchor && (
        <ResizePopover
          colSpan={colSpan}
          rowSpan={rowSpan}
          anchorRect={resizeAnchor}
          onResize={(col, row) => onResize(category.id, col, row)}
          onClose={() => setResizeOpen(false)}
        />
      )}

      {/* Body */}
      {!category.collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {cardType === 'bookmark' && (
            <BookmarkCardBody
              category={category}
              entries={entries}
              density={density}
              onAddEntry={onAddEntry}
              onDeleteEntry={onDeleteEntry}
              onRenameEntry={onRenameEntry}
              onReorderEntries={onReorderEntries}
            />
          )}
          {cardType === 'clock' && (
            <div className="px-4 py-4 flex items-center justify-center">
              <ClockWidget clockFormat={settings.clockFormat} />
            </div>
          )}
          {cardType === 'note' && (
            <NoteCardBody
              content={category.noteContent ?? ''}
              onUpdate={(c) => onUpdateNote?.(category.id, c)}
            />
          )}
          {cardType === 'todo' && (
            <TodoCardBody
              rawContent={category.noteContent ?? '[]'}
              onUpdate={(c) => onUpdateNote?.(category.id, c)}
            />
          )}
          {cardType === 'subscription' && (
            <SubscriptionCardBody category={category} />
          )}
          {cardType === 'tab-groups' && (
            <TabGroupsCardBody category={category} />
          )}
        </div>
      )}
    </div>
  );
}
