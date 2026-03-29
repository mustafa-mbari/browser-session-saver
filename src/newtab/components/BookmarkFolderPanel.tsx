import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Save,
  Home,
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
  FolderPlus,
  Globe,
  Palette,
  ArrowUpDown,
  Tag,
  MoreHorizontal,
  X,
  GripVertical,
  Star,
  BookMarked,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@shared/components/ui/context-menu';
import { ScrollArea } from '@shared/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/components/ui/dialog';
import { Input } from '@shared/components/ui/input';
import { Separator } from '@shared/components/ui/separator';
import { useBookmarkFolderData, type FolderNode } from '@shared/hooks/useBookmarkFolderData';
import type { Board, BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';
import { TOAST_DISMISS_MS } from '@core/constants/timings';

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ec4899', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#ef4444', '#64748b', '#78716c',
];

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function getSortedFolders(folders: BookmarkCategory[], order: string[]): BookmarkCategory[] {
  if (!order.length) return folders;
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...folders].sort((a, b) => (pos.get(a.id) ?? 9999) - (pos.get(b.id) ?? 9999));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogState =
  | { type: 'new-folder'; boardId: string; parentId?: string }
  | { type: 'rename-folder'; folder: BookmarkCategory }
  | { type: 'color-folder'; folder: BookmarkCategory }
  | { type: 'delete-folder'; folder: BookmarkCategory }
  | { type: 'add-entry'; categoryId: string }
  | { type: 'edit-entry'; entry: BookmarkEntry }
  | { type: 'delete-entry'; entry: BookmarkEntry }
  | null;

type SortKey = 'title' | 'category' | 'addedAt';
type SortDir = 'asc' | 'desc';

type ColWidths = { title: number; category: number; description: number };
type ActiveDrag = { id: string; name: string } | null;

// ─── Three-dot dropdown menu (portal-based) ───────────────────────────────────

function ThreeDotMenu({ entry, onEdit, onDelete }: {
  entry: BookmarkEntry; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuH = 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const y = spaceBelow > menuH ? rect.bottom + 4 : rect.top - menuH - 4;
    setPos({ x: rect.right, y });
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-threedot]')) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const item = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
      onClick={() => { onClick(); setOpen(false); }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div data-threedot>
      <button
        ref={btnRef}
        className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-all"
        onClick={toggle}
        title="More actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && createPortal(
        <div
          data-threedot
          className="fixed z-[9999] w-48 rounded-xl border border-white/10 py-1 shadow-2xl overflow-hidden"
          style={{
            left: pos.x - 192,
            top: pos.y,
            background: 'rgba(15,15,20,0.96)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {item(<ExternalLink size={12} />, 'Open in New Tab', () => window.open(entry.url, '_blank', 'noopener'))}
          {item(<Copy size={12} />, 'Copy URL', () => void navigator.clipboard.writeText(entry.url))}
          {item(<Copy size={12} />, 'Copy Title', () => void navigator.clipboard.writeText(entry.title || entry.url))}
          <div className="border-t border-white/8 my-1" />
          {item(<Pencil size={12} />, 'Edit', onEdit)}
          {item(<Trash2 size={12} />, 'Delete', onDelete, true)}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Category Inline Cell ─────────────────────────────────────────────────────

function CategoryCell({ entry, colWidth, allCategories, onUpdate }: {
  entry: BookmarkEntry; colWidth: number; allCategories: string[];
  onUpdate: (category: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [pos, setPos] = useState({ x: 0, y: 0, minW: 160 });
  const cellRef = useRef<HTMLTableCellElement>(null);

  const openDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    setPos({ x: rect.left, y: rect.bottom + 2, minW: Math.max(rect.width, 160) });
    setNewCat('');
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent) => {
      if (!(ev.target as Element).closest('[data-catdrop]')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const select = (cat: string | undefined) => { onUpdate(cat); setOpen(false); };
  const addNew = () => { if (newCat.trim()) { onUpdate(newCat.trim()); setOpen(false); } };

  return (
    <>
      <td
        ref={cellRef}
        className="py-2.5 pr-3 align-middle cursor-pointer select-none"
        style={{ width: colWidth, maxWidth: colWidth, overflow: 'hidden' }}
        onClick={openDropdown}
        title="Click to set category"
      >
        {entry.category ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 max-w-full hover:bg-indigo-500/30 transition-colors">
            <Tag size={9} className="shrink-0" />
            <span className="truncate">{entry.category}</span>
          </span>
        ) : (
          <span className="text-white/25 text-[10px] hover:text-white/50 italic transition-colors">+ category</span>
        )}
      </td>
      {open && createPortal(
        <div
          data-catdrop
          className="fixed z-[9999] rounded-xl border border-white/10 shadow-2xl overflow-hidden py-1"
          style={{ left: pos.x, top: pos.y, minWidth: pos.minW, background: 'rgba(15,15,20,0.96)', backdropFilter: 'blur(24px)' }}
        >
          {entry.category && (
            <button
              data-catdrop
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors text-left"
              onClick={() => select(undefined)}
            >
              <X size={10} className="shrink-0" /> Clear category
            </button>
          )}
          {allCategories.filter((c) => c !== entry.category).map((cat) => (
            <button
              key={cat}
              data-catdrop
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
              onClick={() => select(cat)}
            >
              <Tag size={10} className="text-indigo-400 shrink-0" />
              {cat}
            </button>
          ))}
          {(entry.category || allCategories.length > 0) && <div className="border-t border-white/8 my-1" />}
          <div data-catdrop className="flex items-center gap-1 px-2 pb-1 pt-0.5">
            <input
              data-catdrop
              autoFocus
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addNew(); if (e.key === 'Escape') setOpen(false); }}
              placeholder="New category…"
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/80 placeholder:text-white/25 outline-none focus:border-indigo-500/60"
            />
            <button data-catdrop onClick={addNew} className="p-1.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 transition-colors">
              <Plus size={11} />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Description Inline Cell ──────────────────────────────────────────────────

function DescriptionCell({ entry, colWidth, onUpdate }: {
  entry: BookmarkEntry; colWidth: number;
  onUpdate: (description: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(entry.description ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) requestAnimationFrame(() => inputRef.current?.focus()); }, [editing]);
  useEffect(() => { if (!editing) setVal(entry.description ?? ''); }, [entry.description, editing]);

  const save = () => { onUpdate(val.trim() || undefined); setEditing(false); };
  const cancel = () => { setVal(entry.description ?? ''); setEditing(false); };

  return (
    <td
      className="py-2.5 pr-3 align-middle"
      style={{ width: colWidth, maxWidth: colWidth, overflow: 'hidden', cursor: 'text' }}
      onClick={() => { if (!editing) setEditing(true); }}
      title={editing ? undefined : 'Click to edit description'}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          placeholder="Add a note…"
          className="w-full bg-transparent text-xs text-white/80 border-b border-indigo-500/60 outline-none py-0.5 placeholder:text-white/25"
        />
      ) : (
        <p className="text-xs truncate" title={entry.description}>
          {entry.description
            ? <span className="text-white/50">{entry.description}</span>
            : <span className="text-white/20 hover:text-white/40 italic transition-colors">+ note</span>}
        </p>
      )}
    </td>
  );
}

// ─── Bookmark Table Row ───────────────────────────────────────────────────────

function BookmarkRow({ entry, colWidths, allCategories, onEdit, onDelete, onUpdateCategory, onUpdateDescription }: {
  entry: BookmarkEntry; colWidths: ColWidths; allCategories: string[];
  onEdit: () => void; onDelete: () => void;
  onUpdateCategory: (category: string | undefined) => void;
  onUpdateDescription: (description: string | undefined) => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <tr
      className="group border-b border-white/5 hover:bg-white/5 transition-colors"
      onDoubleClick={() => window.open(entry.url, '_blank', 'noopener')}
    >
      {/* Favicon */}
      <td className="w-10 pl-3 py-2.5 align-middle">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5">
          {entry.favIconUrl && !imgError ? (
            <img src={entry.favIconUrl} alt="" className="w-5 h-5 rounded object-contain" onError={() => setImgError(true)} />
          ) : (
            <Globe size={14} className="text-white/25" />
          )}
        </div>
      </td>

      {/* Title + URL */}
      <td className="py-2.5 pr-3 align-middle" style={{ width: colWidths.title, maxWidth: colWidths.title, overflow: 'hidden' }}>
        <p className="text-sm text-white/90 font-medium truncate leading-tight">{entry.title || getDomain(entry.url)}</p>
        <p className="text-[11px] text-white/35 truncate leading-tight mt-0.5">{getDomain(entry.url)}</p>
      </td>

      {/* Category — inline editable */}
      <CategoryCell entry={entry} colWidth={colWidths.category} allCategories={allCategories} onUpdate={onUpdateCategory} />

      {/* Description — inline editable */}
      <DescriptionCell entry={entry} colWidth={colWidths.description} onUpdate={onUpdateDescription} />

      {/* 3-dot menu */}
      <td className="w-10 py-2.5 pr-2 align-middle text-right">
        <ThreeDotMenu entry={entry} onEdit={onEdit} onDelete={onDelete} />
      </td>
    </tr>
  );
}

// ─── Sortable Quick Access Item ───────────────────────────────────────────────

function SortableQuickItem({ folder, isSelected, onSelect, onRemove, count }: {
  folder: BookmarkCategory; isSelected: boolean;
  onSelect: () => void; onRemove: () => void; count: number;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: folder.id, data: { section: 'quick' },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  const col = folder.color || '#6366f1';
  return (
    <div
      ref={setNodeRef} style={style}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors cursor-pointer ${isSelected ? 'bg-white/20 text-white' : 'hover:bg-white/8 text-white/70 hover:text-white'}`}
      onClick={onSelect}
    >
      <span className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing shrink-0 touch-none" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripVertical size={10} />
      </span>
      <span className="shrink-0" style={{ color: col }}><Folder size={13} /></span>
      <span className="truncate flex-1 text-sm">{folder.name}</span>
      <span className="text-[10px] text-white/30 shrink-0">{count}</span>
      <button
        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-red-400 transition-all shrink-0 p-0.5"
        onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove from Quick Access"
      ><X size={11} /></button>
    </div>
  );
}

// ─── Quick Access Section ─────────────────────────────────────────────────────

function QuickAccessSection({ quickIds, categories, selectedId, onSelect, onRemove, entryCount }: {
  quickIds: string[]; categories: BookmarkCategory[];
  selectedId: string | null; onSelect: (id: string) => void;
  onRemove: (id: string) => void; entryCount: (id: string) => number;
}) {
  const [expanded, setExpanded] = useState(true);
  const items = quickIds.map(id => categories.find(c => c.id === id)).filter((c): c is BookmarkCategory => !!c);
  return (
    <div className="mb-1">
      <button className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/35 hover:text-white/60 transition-colors" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Star size={10} className="text-yellow-400 fill-yellow-400" />
        <span className="flex-1 text-left">Quick Access</span>
      </button>
      {expanded && (
        <div className="mt-0.5">
          <SortableContext items={quickIds} strategy={verticalListSortingStrategy}>
            {items.map(folder => (
              <SortableQuickItem key={folder.id} folder={folder} isSelected={selectedId === folder.id} onSelect={() => onSelect(folder.id)} onRemove={() => onRemove(folder.id)} count={entryCount(folder.id)} />
            ))}
          </SortableContext>
          {items.length === 0 && <p className="px-4 py-1 text-[11px] text-white/20 italic">Right-click a folder to pin it here</p>}
        </div>
      )}
    </div>
  );
}

// ─── Draggable Tree Item ──────────────────────────────────────────────────────

function DraggableTreeItem({ node, depth, selectedId, onSelect, onOpenDialog, entryCount, pinnedIds, onPin, reparentTargetId, folderOrders }: {
  node: FolderNode; depth: number; selectedId: string | null;
  onSelect: (id: string) => void; onOpenDialog: (d: DialogState) => void;
  entryCount: (id: string) => number;
  pinnedIds: string[]; onPin: (id: string) => void;
  reparentTargetId: string | null; folderOrders: Record<string, string[]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedId === node.folder.id;
  const hasChildren = node.children.length > 0;
  const col = node.folder.color || '#f59e0b';
  const isReparentTarget = reparentTargetId === node.folder.id;
  const isPinned = pinnedIds.includes(node.folder.id);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: node.folder.id,
    data: { section: 'my-folders', parentKey: node.folder.parentCategoryId ?? '__root__' },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  const sortedChildren = useMemo(() => {
    const order = folderOrders[node.folder.id] ?? [];
    return getSortedFolders(node.children.map(c => c.folder), order).map(f => node.children.find(c => c.folder.id === f.id)!);
  }, [node.children, folderOrders, node.folder.id]);

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`group flex items-center gap-0.5 py-1 rounded-md text-sm select-none transition-colors cursor-pointer ${
              isReparentTarget ? 'bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/50 text-white'
                : isSelected ? 'bg-white/20 text-white' : 'hover:bg-white/8 text-white/75 hover:text-white'
            }`}
            style={{ paddingLeft: `${4 + depth * 14}px`, paddingRight: '6px' }}
            onClick={() => { onSelect(node.folder.id); setExpanded(true); }}
          >
            <span className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing shrink-0 touch-none px-0.5" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
              <GripVertical size={10} />
            </span>
            <span className="shrink-0 w-4 h-4 flex items-center justify-center opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}>
              {hasChildren ? (expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : <span className="w-3" />}
            </span>
            <span className="shrink-0" style={{ color: col }}>
              {isSelected || expanded ? <FolderOpen size={13} /> : <Folder size={13} />}
            </span>
            <span className="truncate flex-1 text-[13px] pl-1">{node.folder.name}</span>
            {isPinned && <Star size={8} className="text-yellow-400 fill-yellow-400 opacity-60 shrink-0" />}
            <span className="text-[10px] text-white/25 shrink-0 pl-1">{entryCount(node.folder.id)}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Folder</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onOpenDialog({ type: 'new-folder', boardId: node.folder.boardId, parentId: node.folder.id })}>
            <FolderPlus size={13} className="mr-2" /> New Sub-Folder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onOpenDialog({ type: 'add-entry', categoryId: node.folder.id })}>
            <Plus size={13} className="mr-2" /> Add Bookmark
          </ContextMenuItem>
          <ContextMenuSeparator />
          {isPinned ? (
            <ContextMenuItem onClick={() => onPin(node.folder.id)}>
              <Star size={13} className="mr-2 text-yellow-400" /> Remove from Quick Access
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={() => onPin(node.folder.id)}>
              <Star size={13} className="mr-2" /> Add to Quick Access
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onOpenDialog({ type: 'rename-folder', folder: node.folder })}>
            <Pencil size={13} className="mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onOpenDialog({ type: 'color-folder', folder: node.folder })}>
            <Palette size={13} className="mr-2" /> Change Color
          </ContextMenuItem>
          <ContextMenuItem destructive onClick={() => onOpenDialog({ type: 'delete-folder', folder: node.folder })}>
            <Trash2 size={13} className="mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {expanded && hasChildren && (
        <SortableContext items={sortedChildren.map(c => c.folder.id)} strategy={verticalListSortingStrategy}>
          {sortedChildren.map(child => (
            <DraggableTreeItem key={child.folder.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onOpenDialog={onOpenDialog} entryCount={entryCount} pinnedIds={pinnedIds} onPin={onPin} reparentTargetId={reparentTargetId} folderOrders={folderOrders} />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

// ─── My Folders Section ───────────────────────────────────────────────────────

function MyFoldersSection({ categories, boards, selectedId, onSelect, onOpenDialog, entryCount, pinnedIds, onPin, reparentTargetId, folderOrders }: {
  categories: BookmarkCategory[]; boards: Board[];
  selectedId: string | null; onSelect: (id: string) => void;
  onOpenDialog: (d: DialogState) => void; entryCount: (id: string) => number;
  pinnedIds: string[]; onPin: (id: string) => void;
  reparentTargetId: string | null; folderOrders: Record<string, string[]>;
}) {
  const [expanded, setExpanded] = useState(true);
  const defaultBoardId = boards[0]?.id ?? '';

  const nodes = useMemo<FolderNode[]>(() => {
    function buildNodes(parentId: string): FolderNode[] {
      return categories
        .filter(c => c.parentCategoryId === parentId)
        .map(f => ({ folder: f, children: buildNodes(f.id) }));
    }
    const topLevel = categories.filter(c => !c.parentCategoryId && (c.cardType === 'bookmark' || !c.cardType));
    const order = folderOrders['__root__'] ?? [];
    const sorted = getSortedFolders(topLevel, order);
    return sorted.map(f => ({ folder: f, children: buildNodes(f.id) }));
  }, [categories, folderOrders]);

  return (
    <div className="mb-1">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          className="flex items-center gap-1.5 flex-1 text-[10px] font-bold uppercase tracking-wider text-white/35 hover:text-white/60 transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <FolderOpen size={10} className="text-amber-400" />
          <span className="text-left">My Folders</span>
        </button>
        {defaultBoardId && (
          <button
            className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            onClick={() => onOpenDialog({ type: 'new-folder', boardId: defaultBoardId })}
            title="New folder"
          >
            <Plus size={10} />
          </button>
        )}
      </div>
      {expanded && (
        <div>
          {nodes.length === 0 && (
            <p className="px-4 py-1 text-[11px] text-white/20 italic">No folders yet</p>
          )}
          <SortableContext items={nodes.map(n => n.folder.id)} strategy={verticalListSortingStrategy}>
            {nodes.map(node => (
              <DraggableTreeItem key={node.folder.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} onOpenDialog={onOpenDialog} entryCount={entryCount} pinnedIds={pinnedIds} onPin={onPin} reparentTargetId={reparentTargetId} folderOrders={folderOrders} />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

// ─── Browser Folder Node ──────────────────────────────────────────────────────

function BrowserFolderNode({ node, depth }: { node: chrome.bookmarks.BookmarkTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = !node.url;
  const hasChildren = isFolder && !!node.children?.length;
  if (isFolder) {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1 py-1 text-[12px] text-white/55 hover:bg-white/8 hover:text-white/85 rounded-md transition-colors"
          style={{ paddingLeft: `${6 + depth * 14}px`, paddingRight: '6px' }}
          onClick={() => setExpanded(v => !v)}
        >
          <span className="shrink-0 w-4 flex items-center justify-center">
            {hasChildren ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : <span className="w-3" />}
          </span>
          <Folder size={12} className="shrink-0 text-yellow-400/70" />
          <span className="truncate flex-1 text-left pl-0.5">{node.title || '—'}</span>
          {hasChildren && <span className="text-[10px] text-white/20 shrink-0">{node.children!.length}</span>}
        </button>
        {expanded && hasChildren && node.children!.map(child => (
          <BrowserFolderNode key={child.id} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  }
  return (
    <button
      className="w-full flex items-center gap-1 py-1 text-[11px] text-white/40 hover:bg-white/8 hover:text-white/75 rounded-md transition-colors truncate text-left"
      style={{ paddingLeft: `${6 + depth * 14}px`, paddingRight: '6px' }}
      onClick={() => window.open(node.url, '_blank', 'noopener')} title={node.url}
    >
      <Globe size={10} className="shrink-0 opacity-40" />
      <span className="truncate pl-0.5">{node.title || getDomain(node.url!)}</span>
    </button>
  );
}

// ─── Browser Bookmarks Section ────────────────────────────────────────────────

function BrowserBookmarksSection() {
  const [expanded, setExpanded] = useState(false);
  const [tree, setTree] = useState<chrome.bookmarks.BookmarkTreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const handleToggle = () => {
    setExpanded(v => !v);
    if (!tree && !loading) {
      setLoading(true);
      chrome.bookmarks.getTree(result => { setTree(result); setLoading(false); });
    }
  };
  const roots = tree ? (tree[0]?.children ?? []) : [];
  return (
    <div>
      <button className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/35 hover:text-white/60 transition-colors" onClick={handleToggle}>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <BookMarked size={10} className="text-sky-400" />
        <span className="flex-1 text-left">Browser Bookmarks</span>
      </button>
      {expanded && (
        <div className="mt-0.5">
          {loading && <p className="px-4 py-1 text-[11px] text-white/30 italic">Loading…</p>}
          {!loading && roots.map(root => <BrowserFolderNode key={root.id} node={root} depth={0} />)}
          {!loading && roots.length === 0 && tree && <p className="px-4 py-1 text-[11px] text-white/20 italic">No browser bookmarks</p>}
        </div>
      )}
    </div>
  );
}

// ─── Folder Dialog ────────────────────────────────────────────────────────────

function FolderDialog({
  state, onClose, onCreate, onRename, onColorFolder, onDelete, onAddEntry, onEditEntry, onDeleteEntry,
}: {
  state: DialogState; onClose: () => void;
  onCreate: (boardId: string, name: string, parentId?: string) => void;
  onRename: (id: string, name: string) => void;
  onColorFolder: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onAddEntry: (categoryId: string, title: string, url: string, category?: string, description?: string) => void;
  onEditEntry: (id: string, title: string, url: string, category?: string, description?: string) => void;
  onDeleteEntry: (id: string) => void;
}) {
  const [name, setName] = useState(() => {
    if (state?.type === 'rename-folder') return state.folder.name;
    if (state?.type === 'edit-entry') return state.entry.title;
    return '';
  });
  const [url, setUrl] = useState(() => state?.type === 'edit-entry' ? state.entry.url : '');
  const [category, setCategory] = useState(() => state?.type === 'edit-entry' ? (state.entry.category ?? '') : '');
  const [description, setDescription] = useState(() => state?.type === 'edit-entry' ? (state.entry.description ?? '') : '');
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = () => {
    if (!state) return;
    if (state.type === 'new-folder' && name.trim()) onCreate(state.boardId, name.trim(), state.parentId);
    else if (state.type === 'rename-folder' && name.trim()) onRename(state.folder.id, name.trim());
    else if (state.type === 'delete-folder') onDelete(state.folder.id);
    else if (state.type === 'add-entry' && url.trim()) onAddEntry(state.categoryId, name.trim(), url.trim(), category.trim() || undefined, description.trim() || undefined);
    else if (state.type === 'edit-entry') onEditEntry(state.entry.id, name.trim(), url.trim(), category.trim() || undefined, description.trim() || undefined);
    else if (state.type === 'delete-entry') onDeleteEntry(state.entry.id);
    onClose();
  };

  if (!state) return null;

  if (state.type === 'color-folder') {
    const current = state.folder.color || '#6366f1';
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Folder Color — {state.folder.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-6 gap-2 py-1">
            {FOLDER_COLORS.map((color) => (
              <button key={color} className="w-9 h-9 rounded-lg transition-all hover:scale-110 focus:outline-none"
                style={{ backgroundColor: color, boxShadow: current === color ? `0 0 0 3px white, 0 0 0 4px ${color}` : undefined }}
                onClick={() => { onColorFolder(state.folder.id, color); onClose(); }}
              />
            ))}
          </div>
          <DialogFooter>
            <button className="px-3 py-1.5 rounded-md text-sm text-white/60 hover:bg-white/10 transition-colors" onClick={onClose}>Cancel</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isDelete = state.type === 'delete-folder' || state.type === 'delete-entry';
  const isEntry = state.type === 'add-entry' || state.type === 'edit-entry';
  const isFolder = state.type === 'new-folder' || state.type === 'rename-folder';
  const title =
    state.type === 'new-folder' ? (state.parentId ? 'New Sub-Folder' : 'New Folder') :
    state.type === 'rename-folder' ? 'Rename Folder' :
    state.type === 'delete-folder' ? 'Delete Folder' :
    state.type === 'add-entry' ? 'Add Bookmark' :
    state.type === 'edit-entry' ? 'Edit Bookmark' : 'Delete Bookmark';

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {isDelete ? (
          <p className="text-sm text-white/60">
            {state.type === 'delete-folder'
              ? `Delete "${state.folder.name}" and all its contents? This cannot be undone.`
              : `Delete "${state.entry.title || state.entry.url}"?`}
          </p>
        ) : isEntry ? (
          <div className="flex flex-col gap-3">
            <div><label className="block text-xs text-white/50 mb-1">Title</label><Input placeholder="Site title (optional)" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="block text-xs text-white/50 mb-1">URL <span className="text-red-400">*</span></label><Input ref={inputRef} placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-white/50 mb-1">Category</label><Input placeholder="e.g. Work, Dev" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
              <div><label className="block text-xs text-white/50 mb-1">Description</label><Input placeholder="Optional note…" value={description} onChange={(e) => setDescription(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }} /></div>
            </div>
          </div>
        ) : isFolder ? (
          <Input ref={inputRef} placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }} />
        ) : null}
        <DialogFooter className="gap-2">
          <button className="px-3 py-1.5 rounded-md text-sm text-white/60 hover:bg-white/10 transition-colors" onClick={onClose}>Cancel</button>
          <button className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isDelete ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white'}`} onClick={confirm}>
            {isDelete ? 'Delete' : 'Confirm'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function BookmarkFolderPanel() {
  const data = useBookmarkFolderData();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('addedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Resizable columns ──────────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState<ColWidths>({ title: 220, category: 200, description: 130 });
  const resizingRef = useRef<{ col: keyof ColWidths; startX: number; startW: number } | null>(null);
  const colWidthsRef = useRef<ColWidths>({ title: 220, category: 200, description: 130 });
  const [resizeIndicator, setResizeIndicator] = useState<{ x: number; y: number; w: number } | null>(null);

  // Keep ref in sync for stale-closure-safe access inside event handlers
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  // Load persisted column widths on mount
  useEffect(() => {
    chrome.storage.local.get('bookmark_folder_col_widths', (result) => {
      if (result['bookmark_folder_col_widths']) {
        const saved = result['bookmark_folder_col_widths'] as ColWidths;
        setColWidths(saved);
        colWidthsRef.current = saved;
      }
    });
  }, []);

  // ── Quick Access & Folder Ordering ───────────────────────────────────────
  const [quickAccessIds, setQuickAccessIds] = useState<string[]>([]);
  const [folderOrders, setFolderOrders] = useState<Record<string, string[]>>({});

  useEffect(() => {
    chrome.storage.local.get(['bookmark_quick_access', 'bookmark_folder_orders'], (result) => {
      if (result['bookmark_quick_access']) setQuickAccessIds(result['bookmark_quick_access'] as string[]);
      if (result['bookmark_folder_orders']) setFolderOrders(result['bookmark_folder_orders'] as Record<string, string[]>);
    });
  }, []);

  const toggleQuickAccess = useCallback((id: string) => {
    setQuickAccessIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      chrome.storage.local.set({ bookmark_quick_access: next });
      return next;
    });
  }, []);

  // ── Drag and Drop ─────────────────────────────────────────────────────────
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const activeDragIdRef = useRef<string | null>(null);
  const [reparentTargetId, setReparentTargetId] = useState<string | null>(null);
  const reparentTargetRef = useRef<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverIdRef = useRef<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const folder = data.categories.find(c => c.id === active.id);
    if (folder) { setActiveDrag({ id: folder.id, name: folder.name }); activeDragIdRef.current = folder.id; }
  }, [data.categories]);

  const handleDragOver = useCallback(({ over }: DragOverEvent) => {
    const overId = (over?.id ?? null) as string | null;
    if (overId === hoverIdRef.current) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverIdRef.current = overId;
    setReparentTargetId(null); reparentTargetRef.current = null;
    if (overId && overId !== activeDragIdRef.current) {
      hoverTimerRef.current = setTimeout(() => {
        setReparentTargetId(overId); reparentTargetRef.current = overId;
      }, 450);
    }
  }, []);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const reparentId = reparentTargetRef.current;
    setReparentTargetId(null); reparentTargetRef.current = null;
    hoverIdRef.current = null; setActiveDrag(null); activeDragIdRef.current = null;
    if (!over) return;
    // Reparent: hovered over a different folder for 450ms
    if (reparentId && reparentId !== active.id) {
      void data.moveFolder(active.id as string, reparentId);
      return;
    }
    if (active.id === over.id) return;
    const section = (active.data.current as { section?: string })?.section;
    if (section === 'quick') {
      setQuickAccessIds(prev => {
        const oi = prev.indexOf(active.id as string), ni = prev.indexOf(over.id as string);
        if (oi === -1 || ni === -1) return prev;
        const next = arrayMove(prev, oi, ni);
        chrome.storage.local.set({ bookmark_quick_access: next }); return next;
      });
      return;
    }
    if (section === 'my-folders') {
      const af = data.categories.find(c => c.id === active.id);
      const of_ = data.categories.find(c => c.id === over.id);
      if (!af || !of_) return;
      const aKey = af.parentCategoryId ?? '__root__';
      const oKey = of_.parentCategoryId ?? '__root__';
      if (aKey !== oKey) return;
      const siblings = aKey === '__root__'
        ? data.categories.filter(c => !c.parentCategoryId)
        : data.categories.filter(c => c.parentCategoryId === aKey);
      const current = folderOrders[aKey] ?? siblings.map(s => s.id);
      const sorted = getSortedFolders(siblings, current);
      const oi = sorted.findIndex(s => s.id === active.id), ni = sorted.findIndex(s => s.id === over.id);
      if (oi === -1 || ni === -1) return;
      const newOrder = arrayMove(sorted.map(s => s.id), oi, ni);
      setFolderOrders(prev => { const u = { ...prev, [aKey]: newOrder }; chrome.storage.local.set({ bookmark_folder_orders: u }); return u; });
    }
  }, [data, folderOrders]);

  // ─────────────────────────────────────────────────────────────────────────
  const startResize = useCallback((col: keyof ColWidths, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidthsRef.current[col];
    resizingRef.current = { col, startX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const newW = Math.max(80, startW + ev.clientX - startX);
      setColWidths((prev) => ({ ...prev, [col]: newW }));
      setResizeIndicator({ x: ev.clientX + 14, y: ev.clientY - 20, w: newW });
    };
    const onUp = () => {
      resizingRef.current = null;
      setResizeIndicator(null);
      chrome.storage.local.set({ bookmark_folder_col_widths: colWidthsRef.current });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const selectedFolder = selectedFolderId ? data.categories.find((c) => c.id === selectedFolderId) ?? null : null;
  const breadcrumb = selectedFolderId ? data.getFolderPath(selectedFolderId) : [];
  const currentSubFolders = selectedFolderId ? data.categories.filter((c) => c.parentCategoryId === selectedFolderId) : [];

  const rawEntries = selectedFolderId ? data.getEntriesForCategory(selectedFolderId) : [];
  const currentEntries = [...rawEntries].sort((a, b) => {
    let av = '', bv = '';
    if (sortKey === 'title') { av = (a.title || a.url).toLowerCase(); bv = (b.title || b.url).toLowerCase(); }
    else if (sortKey === 'category') { av = (a.category ?? '').toLowerCase(); bv = (b.category ?? '').toLowerCase(); }
    else { av = a.addedAt; bv = b.addedAt; }
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const entryCount = useCallback(
    (folderId: string) => data.entries.filter((e) => e.categoryId === folderId).length,
    [data.entries],
  );

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    data.entries.forEach((e) => { if (e.category) cats.add(e.category); });
    return [...cats].sort();
  }, [data.entries]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleSaveCurrentTab = async () => {
    if (!selectedFolderId) { setSaveMessage('Select a folder first'); setTimeout(() => setSaveMessage(null), 2000); return; }
    const entry = await data.saveCurrentTab(selectedFolderId);
    setSaveMessage(entry ? `Saved: ${entry.title || entry.url}` : 'Could not get current tab');
    setTimeout(() => setSaveMessage(null), TOAST_DISMISS_MS);
  };

  const handleCreate = async (boardId: string, name: string, parentId?: string) => {
    const cat = parentId ? await data.createSubFolder(parentId, name, boardId) : await data.createTopLevelFolder(boardId, name);
    setSelectedFolderId(cat.id);
  };

  const handleDelete = async (id: string) => {
    if (selectedFolderId === id) setSelectedFolderId(null);
    await data.deleteFolder(id);
  };

  if (data.loading) {
    return <div className="flex items-center justify-center h-full text-white/40 text-sm">Loading folders…</div>;
  }

  // Sort header cell
  const SortTh = ({ col, label, width }: { col: SortKey; label: string; width: keyof ColWidths }) => (
    <th
      className="relative py-2.5 pr-3 text-left select-none"
      style={{ width: colWidths[width], minWidth: 80 }}
    >
      <button
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors"
        onClick={() => toggleSort(col)}
      >
        {label}
        <ArrowUpDown size={9} className={sortKey === col ? 'text-indigo-400' : 'text-white/20'} />
      </button>
      {/* Resize handle */}
      <span
        className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize group/rh z-10"
        onMouseDown={(e) => startResize(width, e)}
      >
        <span className="w-px h-4 bg-white/15 group-hover/rh:bg-white/50 group-hover/rh:h-5 transition-all" />
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: 'var(--newtab-text)' }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8 shrink-0 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-0 text-sm text-white/60">
          <Home size={13} className="shrink-0" />
          {breadcrumb.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1 min-w-0">
              <ChevronRight size={11} className="shrink-0 opacity-40" />
              <button className="truncate hover:text-white transition-colors max-w-[120px]" onClick={() => setSelectedFolderId(crumb.id)}>{crumb.name}</button>
            </span>
          ))}
          {breadcrumb.length === 0 && <span className="text-white/30 italic text-xs">Select a folder</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedFolder && (
            <>
              <button className="glass flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/20 transition-colors" onClick={() => setDialogState({ type: 'new-folder', boardId: selectedFolder.boardId, parentId: selectedFolder.id })}>
                <FolderPlus size={13} /> New Folder
              </button>
              <button className="glass flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/20 transition-colors" onClick={() => setDialogState({ type: 'add-entry', categoryId: selectedFolder.id })}>
                <Plus size={13} /> Add
              </button>
              <button className="glass flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/20 transition-colors" onClick={() => setDialogState({ type: 'color-folder', folder: selectedFolder })}>
                <Palette size={13} />
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedFolder.color || '#6366f1' }} />
              </button>
            </>
          )}
          <button
            className={`glass flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${selectedFolder ? 'hover:bg-white/20' : 'opacity-50 cursor-not-allowed'}`}
            onClick={() => void handleSaveCurrentTab()}
          >
            <Save size={13} />
            {saveMessage
              ? <span className={saveMessage.startsWith('Saved') ? 'text-green-400' : 'text-red-400'}>{saveMessage}</span>
              : 'Save Tab'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: 3-Section Tree */}
        <div className="w-60 shrink-0 border-r border-white/8 flex flex-col min-h-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                <QuickAccessSection quickIds={quickAccessIds} categories={data.categories} selectedId={selectedFolderId} onSelect={setSelectedFolderId} onRemove={toggleQuickAccess} entryCount={entryCount} />
                <div className="border-t border-white/5 my-1" />
                <MyFoldersSection categories={data.categories} boards={data.boards} selectedId={selectedFolderId} onSelect={setSelectedFolderId} onOpenDialog={setDialogState} entryCount={entryCount} pinnedIds={quickAccessIds} onPin={toggleQuickAccess} reparentTargetId={reparentTargetId} folderOrders={folderOrders} />
                <div className="border-t border-white/5 my-1" />
                <BrowserBookmarksSection />
              </div>
            </ScrollArea>
            <DragOverlay dropAnimation={null}>
              {activeDrag && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-500/40 text-sm text-white shadow-2xl pointer-events-none" style={{ background: 'rgba(30,30,50,0.95)', backdropFilter: 'blur(20px)' }}>
                  <Folder size={13} className="text-indigo-400 shrink-0" />
                  <span className="font-medium truncate max-w-[140px]">{activeDrag.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!selectedFolder ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-white/25">
              <Folder size={48} className="opacity-20" />
              <p className="text-sm">Select a folder to view its contents</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-4">

                {/* Sub-folders */}
                {currentSubFolders.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">Folders</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                      {currentSubFolders.map((sub) => {
                        const subColor = sub.color || '#f59e0b';
                        return (
                          <ContextMenu key={sub.id}>
                            <ContextMenuTrigger asChild>
                              <button className="flex flex-col items-start gap-2 p-3 rounded-xl glass hover:bg-white/10 transition-all text-left" onClick={() => setSelectedFolderId(sub.id)}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${subColor}22` }}>
                                  <FolderOpen size={22} style={{ color: subColor }} />
                                </div>
                                <span className="truncate text-sm text-white/85 w-full font-medium">{sub.name}</span>
                                <span className="text-[10px] text-white/30">{entryCount(sub.id)} item{entryCount(sub.id) !== 1 ? 's' : ''}</span>
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => setSelectedFolderId(sub.id)}><FolderOpen size={13} className="mr-2" /> Open</ContextMenuItem>
                              <ContextMenuItem onClick={() => setDialogState({ type: 'new-folder', boardId: sub.boardId, parentId: sub.id })}><FolderPlus size={13} className="mr-2" /> New Sub-Folder</ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => setDialogState({ type: 'rename-folder', folder: sub })}><Pencil size={13} className="mr-2" /> Rename</ContextMenuItem>
                              <ContextMenuItem onClick={() => setDialogState({ type: 'color-folder', folder: sub })}><Palette size={13} className="mr-2" /> Change Color</ContextMenuItem>
                              <ContextMenuItem destructive onClick={() => setDialogState({ type: 'delete-folder', folder: sub })}><Trash2 size={13} className="mr-2" /> Delete</ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                    {currentEntries.length > 0 && <Separator className="mt-4" />}
                  </div>
                )}

                {/* Bookmarks table */}
                {currentEntries.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
                      Bookmarks ({currentEntries.length})
                    </p>
                    {/* Glass panel wrapper — no overflow-hidden so portal dropdowns aren't clipped */}
                    <div className="glass-panel rounded-xl border border-white/10" style={{ overflow: 'visible' }}>
                      <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="border-b border-white/8" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            {/* Favicon col — fixed */}
                            <th className="w-10 pl-3 py-2.5" />
                            <SortTh col="title" label="Title" width="title" />
                            <SortTh col="category" label="Category" width="category" />
                            {/* Description — not sortable, still resizable */}
                            <th
                              className="relative py-2.5 pr-3 text-left"
                              style={{ width: colWidths.description, minWidth: 80 }}
                            >
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</span>
                              <span
                                className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize group/rh z-10"
                                onMouseDown={(e) => startResize('description', e)}
                              >
                                <span className="w-px h-4 bg-white/15 group-hover/rh:bg-white/50 group-hover/rh:h-5 transition-all" />
                              </span>
                            </th>
                            {/* Actions col — fixed */}
                            <th className="w-10 py-2.5 pr-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {currentEntries.map((entry) => (
                            <BookmarkRow
                              key={entry.id}
                              entry={entry}
                              colWidths={colWidths}
                              allCategories={allCategories}
                              onEdit={() => setDialogState({ type: 'edit-entry', entry })}
                              onDelete={() => setDialogState({ type: 'delete-entry', entry })}
                              onUpdateCategory={(cat) => void data.renameEntry(entry.id, entry.title, entry.url, cat, entry.description)}
                              onUpdateDescription={(desc) => void data.renameEntry(entry.id, entry.title, entry.url, entry.category, desc)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {currentSubFolders.length === 0 && currentEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/25">
                    <Folder size={32} className="opacity-30" />
                    <p className="text-sm">This folder is empty</p>
                    <button className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors" onClick={() => setDialogState({ type: 'add-entry', categoryId: selectedFolder.id })}>
                      Add a bookmark
                    </button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      <FolderDialog
        state={dialogState}
        onClose={() => setDialogState(null)}
        onCreate={handleCreate}
        onRename={async (id, name) => { await data.renameFolder(id, name); }}
        onColorFolder={async (id, color) => { await data.updateFolderColor(id, color); }}
        onDelete={handleDelete}
        onAddEntry={async (categoryId, title, url, category, description) => { await data.addEntry(categoryId, title, url, category, description); }}
        onEditEntry={async (id, title, url, category, description) => { await data.renameEntry(id, title, url, category, description); }}
        onDeleteEntry={async (id) => { await data.deleteEntry(id); }}
      />

      {/* Live resize width indicator */}
      {resizeIndicator && createPortal(
        <div
          className="fixed z-[9999] bg-indigo-600 text-white text-[10px] font-mono px-2 py-1 rounded-md shadow-lg pointer-events-none"
          style={{ left: resizeIndicator.x, top: resizeIndicator.y }}
        >
          {resizeIndicator.w}px
        </div>,
        document.body,
      )}
    </div>
  );
}
