import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { ChevronDown, ChevronRight, Columns2, Copy, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, Check } from 'lucide-react';
import ContextMenu from '@shared/components/ContextMenu';
import type { BookmarkCategory, BookmarkEntry, CardDensity } from '@core/types/newtab.types';
import { useSortableItems } from '@newtab/hooks/useBookmarkDnd';
import { resolveFavIcon, getFaviconInitial } from '@core/utils/favicon';
import { useNewTabStore } from '@newtab/stores/newtab.store';
import ClockWidget from '@newtab/components/ClockWidget';
import SubscriptionCardBody from '@newtab/components/SubscriptionCardBody';
import TabGroupsCardBody from '@newtab/components/TabGroupsCardBody';
import { generateId } from '@core/utils/uuid';

// ── Bookmark entry row ─────────────────────────────────────────────────────────

interface EntryRowProps {
  entry: BookmarkEntry;
  density: CardDensity;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string, url: string) => void;
}

function BookmarkEntryRow({ entry, density, onDelete, onRename }: EntryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });
  const [imgFailed, setImgFailed] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(entry.title || entry.url);
  const [draftUrl, setDraftUrl] = useState(entry.url);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const rowH = density === 'compact' ? 'py-1' : 'py-1.5';
  const iconCls = density === 'compact' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs';
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm';

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraft(entry.title || entry.url);
    setDraftUrl(entry.url);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitRename = () => {
    const title = draft.trim() || entry.title || entry.url;
    const url = draftUrl.trim() || entry.url;
    onRename(entry.id, title, url);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setDraft(entry.title || entry.url);
    setDraftUrl(entry.url);
    setIsRenaming(false);
  };

  const menuItems = [
    { label: 'Open in new tab', onClick: () => window.open(entry.url, '_blank') },
    { label: 'Edit', icon: Pencil, onClick: () => { setDraft(entry.title || entry.url); setDraftUrl(entry.url); setIsRenaming(true); setTimeout(() => inputRef.current?.focus(), 0); } },
    { label: 'Delete', icon: Trash2, onClick: () => onDelete(entry.id), danger: true },
  ];

  const favicon = !imgFailed ? (
    <img src={resolveFavIcon(entry.favIconUrl, entry.url)} alt="" className={`${iconCls} rounded shrink-0`} onError={() => setImgFailed(true)} />
  ) : (
    <span className={`${iconCls} flex items-center justify-center rounded bg-white/20 font-bold shrink-0`} style={{ color: 'var(--newtab-text)' }}>
      {getFaviconInitial(entry.title, entry.url)}
    </span>
  );

  const itemStyle = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={itemStyle} className="flex flex-col gap-1 px-2 py-1.5 rounded bg-white/5" {...attributes}>
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { urlInputRef.current?.focus(); urlInputRef.current?.select(); }
            if (e.key === 'Escape') cancelRename();
            e.stopPropagation();
          }}
          placeholder="Title"
          className="w-full bg-white/10 rounded px-1.5 py-0.5 text-xs outline-none placeholder-white/30"
          style={{ color: 'var(--newtab-text)' }}
        />
        <input
          ref={urlInputRef}
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') cancelRename();
            e.stopPropagation();
          }}
          placeholder="URL"
          className="w-full bg-white/10 rounded px-1.5 py-0.5 text-xs outline-none placeholder-white/30"
          style={{ color: 'var(--newtab-text)' }}
        />
      </div>
    );
  }

  return (
    <ContextMenu items={menuItems}>
      <div
        ref={setNodeRef}
        style={itemStyle}
        {...attributes}
        className={`flex items-center gap-2 ${rowH} px-1 rounded hover:bg-white/10 cursor-pointer group`}
        onClick={() => window.open(entry.url, '_self')}
      >
        {/* Drag handle — only visible on hover */}
        <div
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0 p-0.5 rounded hover:bg-white/10"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical size={11} style={{ color: 'var(--newtab-text-secondary)' }} />
        </div>
        {favicon}
        <span className={`flex-1 truncate ${textSize}`} style={{ color: 'var(--newtab-text)' }}>
          {entry.title || entry.url}
        </span>
        {/* Hover action buttons */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={startRename}
            className="p-0.5 rounded hover:bg-white/20 transition-colors"
            aria-label="Edit bookmark"
            tabIndex={-1}
          >
            <Pencil size={11} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
            className="p-0.5 rounded hover:bg-red-500/30 transition-colors"
            aria-label="Delete bookmark"
            tabIndex={-1}
          >
            <Trash2 size={11} style={{ color: 'rgba(248,113,113,0.8)' }} />
          </button>
        </div>
      </div>
    </ContextMenu>
  );
}

// ── Clock card body ────────────────────────────────────────────────────────────

function ClockCardBody() {
  const { settings } = useNewTabStore();
  return (
    <div className="px-4 py-4 flex items-center justify-center">
      <ClockWidget clockFormat={settings.clockFormat} />
    </div>
  );
}

// ── Note card body ─────────────────────────────────────────────────────────────

interface NoteCardBodyProps {
  content: string;
  onUpdate: (content: string) => void;
}

function NoteCardBody({ content, onUpdate }: NoteCardBodyProps) {
  const [draft, setDraft] = useState(content);

  const handleBlur = () => {
    if (draft !== content) onUpdate(draft);
  };

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      placeholder="Write your note here…"
      rows={6}
      className="w-full bg-transparent outline-none resize-none text-sm px-4 py-3 placeholder-white/30"
      style={{ color: 'var(--newtab-text)' }}
    />
  );
}

// ── To-Do card body ────────────────────────────────────────────────────────────

interface TodoCardItem { id: string; text: string; done: boolean; }

interface TodoCardBodyProps {
  rawContent: string;
  onUpdate: (content: string) => void;
}

function TodoCardBody({ rawContent, onUpdate }: TodoCardBodyProps) {
  const items: TodoCardItem[] = useMemo(() => {
    try { return JSON.parse(rawContent || '[]') as TodoCardItem[]; }
    catch { return []; }
  }, [rawContent]);

  const [newText, setNewText] = useState('');

  const save = useCallback((next: TodoCardItem[]) => {
    onUpdate(JSON.stringify(next));
  }, [onUpdate]);

  const toggle = (id: string) =>
    save(items.map((it) => it.id === id ? { ...it, done: !it.done } : it));

  const remove = (id: string) =>
    save(items.filter((it) => it.id !== id));

  const add = () => {
    const text = newText.trim();
    if (!text) return;
    save([...items, { id: generateId(), text, done: false }]);
    setNewText('');
  };

  const doneCount = items.filter((it) => it.done).length;

  return (
    <div className="flex flex-col px-3 pb-3 gap-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 group py-0.5">
          <button
            onClick={() => toggle(item.id)}
            className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
              item.done ? 'bg-indigo-500 border-indigo-500' : 'border-white/30 hover:border-white/60'
            }`}
            aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.done && <Check size={10} color="white" />}
          </button>
          <span
            className={`flex-1 text-sm truncate ${item.done ? 'line-through opacity-50' : ''}`}
            style={{ color: 'var(--newtab-text)' }}
          >
            {item.text}
          </span>
          <button
            onClick={() => remove(item.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
            aria-label="Remove item"
          >
            <Trash2 size={11} style={{ color: 'rgba(255,100,100,0.7)' }} />
          </button>
        </div>
      ))}

      {items.length > 0 && (
        <p className="text-[10px] opacity-40 mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
          {doneCount}/{items.length} done
        </p>
      )}

      <div className="flex items-center gap-1 mt-1">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add item…"
          className="flex-1 bg-white/10 rounded px-2 py-1 text-xs outline-none placeholder-white/30"
          style={{ color: 'var(--newtab-text)' }}
        />
        <button
          onClick={add}
          disabled={!newText.trim()}
          className="p-1 rounded hover:bg-white/15 transition-colors disabled:opacity-30"
          aria-label="Add item"
        >
          <Plus size={13} style={{ color: 'var(--newtab-text)' }} />
        </button>
      </div>
    </div>
  );
}

// ── Bookmark card body ─────────────────────────────────────────────────────────

interface BookmarkCardBodyProps {
  category: BookmarkCategory;
  entries: BookmarkEntry[];
  density: CardDensity;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
  onRenameEntry: (id: string, title: string, url: string) => void;
  onReorderEntries: (categoryId: string, orderedIds: string[]) => void;
}

function BookmarkCardBody({
  category, entries, density, onAddEntry, onDeleteEntry, onRenameEntry, onReorderEntries,
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
        <div ref={scrollRef} style={{ height: Math.min(entries.length * rowHeight, 320), overflow: 'auto' }}>
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

// ── Resize popover (3×3 grid picker) ──────────────────────────────────────────

interface ResizePopoverProps {
  colSpan: 1 | 2 | 3;
  rowSpan: 1 | 2 | 3;
  anchorRect: DOMRect;
  onResize: (col: 1 | 2 | 3, row: 1 | 2 | 3) => void;
  onClose: () => void;
}

function ResizePopover({ colSpan, rowSpan, anchorRect, onResize, onClose }: ResizePopoverProps) {
  const [hoverCol, setHoverCol] = useState(colSpan);
  const [hoverRow, setHoverRow] = useState(rowSpan);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const top = anchorRect.bottom + 6;
  const right = window.innerWidth - anchorRect.right;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, right, zIndex: 9999, backgroundColor: 'rgba(15,15,30,0.92)', backdropFilter: 'blur(20px)' }}
      className="rounded-xl p-3 shadow-2xl border border-white/10"
    >
      <p className="text-xs text-center mb-2.5 font-medium tabular-nums" style={{ color: 'var(--newtab-text-secondary)' }}>
        <span style={{ color: 'var(--newtab-text)' }}>{hoverCol}w × {hoverRow}h</span>
      </p>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
        onMouseLeave={() => { setHoverCol(colSpan); setHoverRow(rowSpan); }}
      >
        {([1, 2, 3] as const).flatMap((row) =>
          ([1, 2, 3] as const).map((col) => {
            const filled = col <= hoverCol && row <= hoverRow;
            const current = col === colSpan && row === rowSpan;
            return (
              <button
                key={`${col}-${row}`}
                onMouseEnter={() => { setHoverCol(col); setHoverRow(row); }}
                onClick={() => { onResize(col, row); onClose(); }}
                aria-label={`${col}×${row}`}
                className={`w-9 h-9 rounded-md border-2 transition-all duration-75 ${
                  filled
                    ? 'bg-indigo-500/70 border-indigo-400/90'
                    : current
                    ? 'bg-white/10 border-white/50'
                    : 'bg-white/5 border-white/15 hover:border-white/30'
                }`}
              />
            );
          }),
        )}
      </div>
      <p className="text-[10px] text-center mt-2 opacity-40" style={{ color: 'var(--newtab-text)' }}>
        width × height
      </p>
    </div>,
    document.body,
  );
}

// ── Main card component ────────────────────────────────────────────────────────

interface Props {
  category: BookmarkCategory;
  entries: BookmarkEntry[];
  density: CardDensity;
  colSpan: 1 | 2 | 3;
  rowSpan: 1 | 2 | 3;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
  onRenameEntry: (id: string, title: string, url: string) => void;
  onDeleteCategory: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onReorderEntries: (categoryId: string, orderedIds: string[]) => void;
  onResize: (id: string, colSpan: 1 | 2 | 3, rowSpan: 1 | 2 | 3) => void;
  onUpdateNote?: (id: string, content: string) => void;
  onRenameCard: (id: string, name: string) => void;
  onDuplicateCard: (id: string) => void;
}

export default function BookmarkCategoryCard({
  category,
  entries,
  density,
  colSpan,
  rowSpan,
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

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

  // Badge shown next to name
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
        {/* Drag handle */}
        <div
          className="p-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors shrink-0"
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }} />
        </div>

        {/* Icon */}
        <span className="text-base shrink-0">{category.icon}</span>

        {/* Name / inline rename input */}
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

        {/* Badge */}
        {badge !== null && !isRenaming && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 shrink-0" style={{ color: 'var(--newtab-text-secondary)' }}>
            {badge}
          </span>
        )}

        {/* Collapse chevron */}
        {!isRenaming && (
          <button onClick={() => onToggleCollapse(category.id)} className="shrink-0 p-0.5">
            {category.collapsed
              ? <ChevronRight size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
              : <ChevronDown  size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
            }
          </button>
        )}

        {/* Resize button */}
        <button
          ref={resizeBtnRef}
          onClick={openResize}
          className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
          aria-label="Resize card"
          title={`${colSpan}w × ${rowSpan}h`}
        >
          <Columns2 size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
        </button>

        {/* 3-dot menu */}
        <ContextMenu items={menuItems}>
          <button
            className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
            aria-label="Card options"
          >
            <MoreHorizontal size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
        </ContextMenu>
      </div>

      {/* Resize popover */}
      {resizeOpen && resizeAnchor && (
        <ResizePopover
          colSpan={colSpan}
          rowSpan={rowSpan}
          anchorRect={resizeAnchor}
          onResize={(col, row) => onResize(category.id, col, row)}
          onClose={() => setResizeOpen(false)}
        />
      )}

      {/* Body — varies by card type */}
      {!category.collapsed && cardType === 'bookmark' && (
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
      {!category.collapsed && cardType === 'clock' && <ClockCardBody />}
      {!category.collapsed && cardType === 'note' && (
        <NoteCardBody
          content={category.noteContent ?? ''}
          onUpdate={(c) => onUpdateNote?.(category.id, c)}
        />
      )}
      {!category.collapsed && cardType === 'todo' && (
        <TodoCardBody
          rawContent={category.noteContent ?? '[]'}
          onUpdate={(c) => onUpdateNote?.(category.id, c)}
        />
      )}
      {!category.collapsed && cardType === 'subscription' && (
        <SubscriptionCardBody category={category} />
      )}
      {!category.collapsed && cardType === 'tab-groups' && (
        <TabGroupsCardBody category={category} />
      )}
    </div>
  );
}
