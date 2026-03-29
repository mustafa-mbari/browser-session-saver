import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  Bookmark,
  BookMarked,
  Globe,
  Star,
  Plus,
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
  FolderPlus,
  Palette,
  X,
  Save,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@shared/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/components/ui/dialog';
import { Input } from '@shared/components/ui/input';
import { useBookmarkFolderData } from '@shared/hooks/useBookmarkFolderData';
import type { BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';

const FOLDER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ec4899', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#ef4444', '#64748b', '#78716c',
];

function isBookmarkFolder(cat: BookmarkCategory): boolean {
  return cat.cardType === 'bookmark' || !cat.cardType;
}

type DialogState =
  | { type: 'new-folder'; boardId: string; parentId?: string }
  | { type: 'rename-folder'; folder: BookmarkCategory }
  | { type: 'color-folder'; folder: BookmarkCategory }
  | { type: 'delete-folder'; folder: BookmarkCategory }
  | { type: 'add-entry'; categoryId: string }
  | { type: 'edit-entry'; entry: BookmarkEntry }
  | { type: 'delete-entry'; entry: BookmarkEntry }
  | null;

// ─── Dialog ──────────────────────────────────────────────────────────────────

function FolderDialog({
  state,
  onClose,
  onCreate,
  onCreateSub,
  onRename,
  onColorFolder,
  onDelete,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  categories,
}: {
  state: DialogState;
  onClose: () => void;
  onCreate: (boardId: string, name: string) => void;
  onCreateSub: (parentId: string, name: string, boardId: string) => void;
  onRename: (id: string, name: string) => void;
  onColorFolder: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onEditEntry: (id: string, title: string, url: string, newCategoryId: string) => void;
  onDeleteEntry: (id: string) => void;
  categories: BookmarkCategory[];
}) {
  const [value, setValue] = useState(() => {
    if (state?.type === 'rename-folder') return state.folder.name;
    if (state?.type === 'edit-entry') return state.entry.title;
    return '';
  });
  const [urlValue, setUrlValue] = useState(() =>
    state?.type === 'edit-entry' ? state.entry.url : ''
  );
  const [editCategoryId, setEditCategoryId] = useState(() =>
    state?.type === 'edit-entry' ? state.entry.categoryId : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  if (!state) return null;

  if (state.type === 'color-folder') {
    const current = state.folder.color || '#6366f1';
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-[280px]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm">Folder Color — {state.folder.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-6 gap-2 py-1">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color}
                className="w-8 h-8 rounded-lg transition-all hover:scale-110 focus:outline-none"
                style={{
                  backgroundColor: color,
                  boxShadow: current === color ? `0 0 0 2px white, 0 0 0 3px ${color}` : undefined,
                }}
                onClick={() => { onColorFolder(state.folder.id, color); onClose(); }}
              />
            ))}
          </div>
          <DialogFooter className="mt-1">
            <button className="px-2.5 py-1 rounded text-xs text-white/60 hover:bg-white/10 transition-colors" onClick={onClose}>Cancel</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isDelete = state.type === 'delete-folder' || state.type === 'delete-entry';
  const title =
    state.type === 'new-folder' ? (state.parentId ? 'New Sub-Folder' : 'New Folder') :
    state.type === 'rename-folder' ? 'Rename Folder' :
    state.type === 'delete-folder' ? 'Delete Folder' :
    state.type === 'add-entry' ? 'Add URL' :
    state.type === 'edit-entry' ? 'Edit Bookmark' : 'Delete Entry';

  const confirm = () => {
    if (!state) return;
    if (state.type === 'new-folder' && value.trim()) {
      if (state.parentId) {
        onCreateSub(state.parentId, value.trim(), state.boardId);
      } else {
        onCreate(state.boardId, value.trim());
      }
    } else if (state.type === 'rename-folder' && value.trim()) onRename(state.folder.id, value.trim());
    else if (state.type === 'delete-folder') onDelete(state.folder.id);
    else if (state.type === 'add-entry' && urlValue.trim()) onAddEntry(state.categoryId, value.trim() || urlValue.trim(), urlValue.trim());
    else if (state.type === 'edit-entry') onEditEntry(state.entry.id, value.trim() || state.entry.title, urlValue.trim() || state.entry.url, editCategoryId);
    else if (state.type === 'delete-entry') onDeleteEntry(state.entry.id);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[320px]" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        {isDelete ? (
          <p className="text-xs text-white/60">
            {state.type === 'delete-folder'
              ? `Delete "${state.folder.name}" and all its contents?`
              : `Delete "${state.entry.title || state.entry.url}"?`}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {state.type === 'add-entry' && (
              <>
                <Input ref={inputRef} placeholder="Title (optional)" value={value} onChange={(e) => setValue(e.target.value)} className="text-xs h-8" />
                <Input placeholder="https://example.com" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }} className="text-xs h-8" />
              </>
            )}
            {state.type === 'edit-entry' && (
              <>
                <Input ref={inputRef} placeholder="Title" value={value} onChange={(e) => setValue(e.target.value)} className="text-xs h-8" />
                <Input placeholder="https://example.com" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} className="text-xs h-8" />
                <div>
                  <label className="block text-[10px] opacity-50 mb-1" style={{ color: 'var(--color-text)' }}>Folder</label>
                  <select
                    className="w-full rounded bg-white/10 text-xs px-2 py-1.5 border border-white/15 focus:outline-none focus:border-white/40"
                    style={{ color: 'var(--color-text)' }}
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                  >
                    {categories
                      .filter((c) => c.cardType === 'bookmark' || !c.cardType)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
              </>
            )}
            {(state.type === 'new-folder' || state.type === 'rename-folder') && (
              <Input ref={inputRef} placeholder="Folder name" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }} className="text-xs h-8" />
            )}
          </div>
        )}
        <DialogFooter className="gap-1.5 mt-1">
          <button className="px-2.5 py-1 rounded text-xs text-white/60 hover:bg-white/10 transition-colors" onClick={onClose}>Cancel</button>
          <button
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${isDelete ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white'}`}
            onClick={confirm}
          >
            {isDelete ? 'Delete' : 'Confirm'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Entry Row ───────────────────────────────────────────────────────────────

function EntryRow({ entry, onDialog }: { entry: BookmarkEntry; onDialog: (d: DialogState) => void }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors text-left group"
          onDoubleClick={() => window.open(entry.url, '_blank', 'noopener')}
          title={entry.url}
        >
          {entry.favIconUrl ? (
            <img src={entry.favIconUrl} alt="" className="w-3.5 h-3.5 shrink-0 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <Bookmark size={12} className="shrink-0 opacity-40" style={{ color: 'var(--color-text)' }} />
          )}
          <span className="flex-1 min-w-0">
            <span className="block truncate text-xs leading-tight" style={{ color: 'var(--color-text)' }}>{entry.title || entry.url}</span>
            <span className="block truncate text-[10px] leading-tight opacity-40" style={{ color: 'var(--color-text)' }}>{entry.url}</span>
          </span>
          <ExternalLink
            size={11}
            className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-pointer"
            style={{ color: 'var(--color-text)' }}
            onClick={(e) => { e.stopPropagation(); window.open(entry.url, '_blank', 'noopener'); }}
          />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => window.open(entry.url, '_blank', 'noopener')}>
          <ExternalLink size={12} className="mr-2" /> Open
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(entry.url).catch(() => {})}>
          <Copy size={12} className="mr-2" /> Copy URL
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDialog({ type: 'edit-entry', entry })}>
          <Pencil size={12} className="mr-2" /> Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDialog({ type: 'delete-entry', entry })} className="text-red-400">
          <Trash2 size={12} className="mr-2" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Folder Row ──────────────────────────────────────────────────────────────

function FolderRow({
  folder,
  allCategories,
  getEntriesForCategory,
  onDialog,
  depth,
  quickAccessIds,
  onToggleQuickAccess,
  onSaveCurrentTab,
}: {
  folder: BookmarkCategory;
  allCategories: BookmarkCategory[];
  getEntriesForCategory: (id: string) => BookmarkEntry[];
  onDialog: (d: DialogState) => void;
  depth: number;
  quickAccessIds: string[];
  onToggleQuickAccess: (id: string) => void;
  onSaveCurrentTab: (categoryId: string) => void;
}) {
  const isPinned = quickAccessIds.includes(folder.id);
  const [expanded, setExpanded] = useState(false);
  const folderEntries = getEntriesForCategory(folder.id);
  const childFolders = allCategories.filter(
    (c) => c.parentCategoryId === folder.id && isBookmarkFolder(c),
  );
  const Icon = expanded ? FolderOpen : FolderIcon;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors text-left"
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown size={12} className="shrink-0 opacity-50" /> : <ChevronRight size={12} className="shrink-0 opacity-50" />}
            <Icon size={14} className="shrink-0" style={{ color: folder.color || '#6366f1' }} />
            <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--color-text)' }}>{folder.name}</span>
            <span className="text-[10px] opacity-40 shrink-0">{folderEntries.length}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onDialog({ type: 'add-entry', categoryId: folder.id })}>
            <Plus size={12} className="mr-2" /> Add URL
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onSaveCurrentTab(folder.id)}>
            <Save size={12} className="mr-2" /> Save Current Tab
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDialog({ type: 'new-folder', boardId: folder.boardId, parentId: folder.id })}>
            <FolderPlus size={12} className="mr-2" /> New Sub-Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDialog({ type: 'rename-folder', folder })}>
            <Pencil size={12} className="mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDialog({ type: 'color-folder', folder })}>
            <Palette size={12} className="mr-2" /> Change Color
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onToggleQuickAccess(folder.id)}>
            <Star size={12} className={`mr-2 ${isPinned ? 'text-yellow-400 fill-yellow-400' : ''}`} />
            {isPinned ? 'Remove from Quick Access' : 'Add to Quick Access'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDialog({ type: 'delete-folder', folder })} className="text-red-400">
            <Trash2 size={12} className="mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && (
        <div>
          {childFolders.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              allCategories={allCategories}
              getEntriesForCategory={getEntriesForCategory}
              onDialog={onDialog}
              depth={depth + 1}
              quickAccessIds={quickAccessIds}
              onToggleQuickAccess={onToggleQuickAccess}
              onSaveCurrentTab={onSaveCurrentTab}
            />
          ))}
          {folderEntries.map((entry) => (
            <div key={entry.id} style={{ paddingLeft: `${depth * 16}px` }}>
              <EntryRow entry={entry} onDialog={onDialog} />
            </div>
          ))}
          {childFolders.length === 0 && folderEntries.length === 0 && (
            <p className="text-[10px] opacity-40 py-1" style={{ paddingLeft: `${24 + depth * 16}px`, color: 'var(--color-text)' }}>
              Empty folder
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quick Access Section ────────────────────────────────────────────────────

function QuickAccessSection({
  quickIds,
  categories,
  getEntriesForCategory,
  onRemove,
}: {
  quickIds: string[];
  categories: BookmarkCategory[];
  getEntriesForCategory: (id: string) => BookmarkEntry[];
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const items = quickIds.map((id) => categories.find((c) => c.id === id)).filter((c): c is BookmarkCategory => !!c);

  return (
    <div className="mb-1">
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 hover:opacity-80 transition-opacity"
        style={{ color: 'var(--color-text)' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Star size={10} className="text-yellow-400 fill-yellow-400" />
        <span className="flex-1 text-left">Quick Access</span>
      </button>
      {expanded && (
        <div className="mt-0.5">
          {items.map((folder) => {
            const count = getEntriesForCategory(folder.id).length;
            return (
              <div
                key={folder.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors group"
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: folder.color || '#6366f1' }} />
                <span className="flex-1 truncate text-xs" style={{ color: 'var(--color-text)' }}>{folder.name}</span>
                <span className="text-[10px] opacity-40 shrink-0">{count}</span>
                <button
                  onClick={() => onRemove(folder.id)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                  aria-label="Remove from Quick Access"
                >
                  <X size={10} style={{ color: 'var(--color-text)' }} />
                </button>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="px-4 py-1 text-[11px] opacity-30 italic" style={{ color: 'var(--color-text)' }}>
              Right-click a folder to pin it here
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Browser Bookmarks Section ───────────────────────────────────────────────

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function BrowserFolderNode({ node, depth }: { node: chrome.bookmarks.BookmarkTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = !node.url;
  const hasChildren = isFolder && !!node.children?.length;

  if (isFolder) {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1 py-1 text-xs hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
          style={{ paddingLeft: `${6 + depth * 14}px`, paddingRight: '6px', color: 'var(--color-text)' }}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="shrink-0 w-4 flex items-center justify-center">
            {hasChildren ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : <span className="w-3" />}
          </span>
          <FolderIcon size={12} className="shrink-0 text-yellow-400/70" />
          <span className="truncate flex-1 text-left pl-0.5">{node.title || '—'}</span>
          {hasChildren && <span className="text-[10px] opacity-30 shrink-0">{node.children!.length}</span>}
        </button>
        {expanded && hasChildren && node.children!.map((child) => (
          <BrowserFolderNode key={child.id} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <button
      className="w-full flex items-center gap-1 py-1 text-[11px] opacity-60 hover:bg-[var(--color-bg-hover)] hover:opacity-100 rounded-md transition-colors truncate text-left"
      style={{ paddingLeft: `${6 + depth * 14}px`, paddingRight: '6px', color: 'var(--color-text)' }}
      onClick={() => window.open(node.url, '_blank', 'noopener')}
      title={node.url}
    >
      <Globe size={10} className="shrink-0 opacity-40" />
      <span className="truncate pl-0.5">{node.title || getDomain(node.url!)}</span>
    </button>
  );
}

function BrowserBookmarksSection() {
  const [expanded, setExpanded] = useState(false);
  const [tree, setTree] = useState<chrome.bookmarks.BookmarkTreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = () => {
    setExpanded((v) => !v);
    if (!tree && !loading) {
      setLoading(true);
      chrome.bookmarks.getTree((result) => { setTree(result); setLoading(false); });
    }
  };

  const roots = tree ? (tree[0]?.children ?? []) : [];

  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 hover:opacity-80 transition-opacity"
        style={{ color: 'var(--color-text)' }}
        onClick={handleToggle}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <BookMarked size={10} className="text-sky-400" />
        <span className="flex-1 text-left">Browser Bookmarks</span>
      </button>
      {expanded && (
        <div className="mt-0.5">
          {loading && <p className="px-4 py-1 text-[11px] opacity-30 italic" style={{ color: 'var(--color-text)' }}>Loading…</p>}
          {!loading && roots.map((root) => <BrowserFolderNode key={root.id} node={root} depth={0} />)}
          {!loading && roots.length === 0 && tree && <p className="px-4 py-1 text-[11px] opacity-30 italic" style={{ color: 'var(--color-text)' }}>No browser bookmarks</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export default function FoldersView() {
  const {
    boards,
    categories,
    loading,
    createTopLevelFolder,
    createSubFolder,
    renameFolder,
    updateFolderColor,
    deleteFolder,
    addEntry,
    renameEntry,
    moveEntry,
    deleteEntry,
    saveCurrentTab,
    getEntriesForCategory,
  } = useBookmarkFolderData();
  const [dialog, setDialog] = useState<DialogState>(null);

  // Quick Access state
  const [quickAccessIds, setQuickAccessIds] = useState<string[]>([]);
  useEffect(() => {
    chrome.storage.local.get(['bookmark_quick_access'], (result) => {
      if (result['bookmark_quick_access']) setQuickAccessIds(result['bookmark_quick_access'] as string[]);
    });
  }, []);

  const toggleQuickAccess = useCallback((id: string) => {
    setQuickAccessIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      chrome.storage.local.set({ bookmark_quick_access: next });
      return next;
    });
  }, []);

  // Only show bookmark-type categories (not clock/note/todo/subscription widgets)
  const bookmarkCategories = categories.filter(isBookmarkFolder);

  // Root folders: no parentCategoryId
  const rootFolders = bookmarkCategories.filter((c) => !c.parentCategoryId);

  // Use the first board as default for creating new top-level folders
  const defaultBoardId = boards[0]?.id ?? '';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>Folders</span>
        <button
          onClick={() => setDialog({ type: 'new-folder', boardId: defaultBoardId })}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <FolderPlus size={12} />
          New Folder
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {/* Quick Access */}
        <QuickAccessSection
          quickIds={quickAccessIds}
          categories={bookmarkCategories}
          getEntriesForCategory={getEntriesForCategory}
          onRemove={toggleQuickAccess}
        />

        {/* My Folders */}
        <div className="mb-1">
          <div
            className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50"
            style={{ color: 'var(--color-text)' }}
          >
            <FolderOpen size={10} className="text-primary" />
            <span>My Folders</span>
          </div>
          {rootFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <FolderOpen size={28} className="opacity-20" style={{ color: 'var(--color-text)' }} />
              <p className="text-xs opacity-40" style={{ color: 'var(--color-text)' }}>No folders yet</p>
              <button
                onClick={() => setDialog({ type: 'new-folder', boardId: defaultBoardId })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                Create Folder
              </button>
            </div>
          ) : (
            rootFolders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                allCategories={bookmarkCategories}
                getEntriesForCategory={getEntriesForCategory}
                onDialog={setDialog}
                depth={0}
                quickAccessIds={quickAccessIds}
                onToggleQuickAccess={toggleQuickAccess}
                onSaveCurrentTab={(categoryId) => { void saveCurrentTab(categoryId); }}
              />
            ))
          )}
        </div>

        {/* Browser Bookmarks */}
        <BrowserBookmarksSection />
      </div>

      {/* Dialogs */}
      <FolderDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onCreate={(boardId, name) => { void createTopLevelFolder(boardId, name); }}
        onCreateSub={(parentId, name, boardId) => { void createSubFolder(parentId, name, boardId); }}
        onRename={(id, name) => { void renameFolder(id, name); }}
        onColorFolder={(id, color) => { void updateFolderColor(id, color); }}
        onDelete={(id) => { void deleteFolder(id); }}
        onAddEntry={(categoryId, title, url) => { void addEntry(categoryId, title, url); }}
        onEditEntry={(id, title, url, newCategoryId) => {
          if (dialog?.type === 'edit-entry' && dialog.entry.categoryId !== newCategoryId) {
            void moveEntry(id, newCategoryId);
          }
          void renameEntry(id, title, url);
        }}
        onDeleteEntry={(id) => { void deleteEntry(id); }}
        categories={bookmarkCategories}
      />
    </div>
  );
}
