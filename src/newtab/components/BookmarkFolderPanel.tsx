import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ec4899', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#ef4444', '#64748b', '#78716c',
];

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
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

// ─── Tree Item ────────────────────────────────────────────────────────────────

function TreeItem({ node, depth, selectedId, onSelect, onOpenDialog, entryCount }: {
  node: FolderNode; depth: number; selectedId: string | null;
  onSelect: (id: string) => void; onOpenDialog: (d: DialogState) => void; entryCount: (id: string) => number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedId === node.folder.id;
  const hasChildren = node.children.length > 0;
  const folderColor = node.folder.color || '#f59e0b';

  const toggle = (e: React.MouseEvent) => { e.stopPropagation(); setExpanded((v) => !v); };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-sm select-none transition-colors cursor-pointer text-left ${isSelected ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/80 hover:text-white'}`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={() => { onSelect(node.folder.id); setExpanded(true); }}
          >
            <span className="shrink-0 w-4 h-4 flex items-center justify-center opacity-50 hover:opacity-100" onClick={toggle}>
              {hasChildren ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
            </span>
            <span className="shrink-0" style={{ color: folderColor }}>
              {isSelected || expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
            </span>
            <span className="truncate flex-1">{node.folder.name}</span>
            <span className="text-[10px] text-white/30 shrink-0">{entryCount(node.folder.id)}</span>
          </button>
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
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.folder.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onOpenDialog={onOpenDialog} entryCount={entryCount} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Board Section ────────────────────────────────────────────────────────────

function BoardSection({ board, tree, selectedId, onSelect, onOpenDialog, entryCount }: {
  board: Board; tree: FolderNode[]; selectedId: string | null;
  onSelect: (id: string) => void; onOpenDialog: (d: DialogState) => void; entryCount: (id: string) => number;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="mb-1">
      <button
        className="w-full flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="mr-1">{board.icon}</span>
        <span className="truncate flex-1 text-left">{board.name}</span>
        <span className="ml-auto p-0.5 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); onOpenDialog({ type: 'new-folder', boardId: board.id }); }}>
          <Plus size={11} />
        </span>
      </button>
      {expanded && (
        <div>
          {tree.map((node) => (
            <TreeItem key={node.folder.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} onOpenDialog={onOpenDialog} entryCount={entryCount} />
          ))}
          {tree.length === 0 && <p className="px-6 py-1 text-xs text-white/25 italic">No folders</p>}
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
    setTimeout(() => setSaveMessage(null), 2500);
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
        {/* Left: Tree */}
        <div className="w-60 shrink-0 border-r border-white/8 flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-2">
              {data.boards.length === 0 && <p className="px-3 py-4 text-xs text-white/30 text-center italic">No boards yet</p>}
              {data.boards.map((board) => (
                <BoardSection key={board.id} board={board} tree={data.getFolderTreeForBoard(board.id)} selectedId={selectedFolderId} onSelect={setSelectedFolderId} onOpenDialog={setDialogState} entryCount={entryCount} />
              ))}
            </div>
          </ScrollArea>
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
