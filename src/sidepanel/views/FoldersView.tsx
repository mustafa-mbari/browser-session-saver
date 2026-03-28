import { useState, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  Bookmark,
  Plus,
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
  FolderPlus,
  Palette,
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
  onDeleteEntry,
}: {
  state: DialogState;
  onClose: () => void;
  onCreate: (boardId: string, name: string) => void;
  onCreateSub: (parentId: string, name: string, boardId: string) => void;
  onRename: (id: string, name: string) => void;
  onColorFolder: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
}) {
  const [value, setValue] = useState(() => {
    if (state?.type === 'rename-folder') return state.folder.name;
    return '';
  });
  const [urlValue, setUrlValue] = useState('');
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
    state.type === 'add-entry' ? 'Add URL' : 'Delete Entry';

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
}: {
  folder: BookmarkCategory;
  allCategories: BookmarkCategory[];
  getEntriesForCategory: (id: string) => BookmarkEntry[];
  onDialog: (d: DialogState) => void;
  depth: number;
}) {
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
    deleteEntry,
    getEntriesForCategory,
  } = useBookmarkFolderData();
  const [dialog, setDialog] = useState<DialogState>(null);

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

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {rootFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FolderOpen size={36} className="opacity-30" style={{ color: 'var(--color-text)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>No folders yet</p>
              <p className="text-xs mt-1 opacity-50" style={{ color: 'var(--color-text)' }}>Create a folder to save tabs and URLs</p>
            </div>
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
            />
          ))
        )}
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
        onDeleteEntry={(id) => { void deleteEntry(id); }}
      />
    </div>
  );
}
