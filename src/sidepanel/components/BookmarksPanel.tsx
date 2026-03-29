import { useState, useRef, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Bookmark,
  Plus,
  Save,
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
  FolderPlus,
  RefreshCw,
  Palette,
  Tag,
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
import { TOAST_DISMISS_MS } from '@core/constants/timings';

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogState =
  | { type: 'new-folder'; boardId: string; parentId?: string }
  | { type: 'rename-folder'; folder: BookmarkCategory }
  | { type: 'color-folder'; folder: BookmarkCategory }
  | { type: 'delete-folder'; folder: BookmarkCategory }
  | { type: 'add-entry'; categoryId: string }
  | { type: 'rename-entry'; entry: BookmarkEntry }
  | { type: 'delete-entry'; entry: BookmarkEntry }
  | null;

const FOLDER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ec4899', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#ef4444', '#64748b', '#78716c',
];

// ─── Inline Dialog ────────────────────────────────────────────────────────────

function BookmarkDialog({
  state,
  onClose,
  onCreate,
  onRename,
  onColorFolder,
  onDelete,
  onAddEntry,
  onRenameEntry,
  onDeleteEntry,
}: {
  state: DialogState;
  onClose: () => void;
  onCreate: (boardId: string, name: string, parentId?: string) => void;
  onRename: (id: string, name: string) => void;
  onColorFolder: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onAddEntry: (categoryId: string, title: string, url: string, category?: string, description?: string) => void;
  onRenameEntry: (id: string, title: string, url: string, category?: string, description?: string) => void;
  onDeleteEntry: (id: string) => void;
}) {
  const [value, setValue] = useState(() => {
    if (state?.type === 'rename-folder') return state.folder.name;
    if (state?.type === 'rename-entry') return state.entry.title;
    return '';
  });
  const [urlValue, setUrlValue] = useState(() => {
    if (state?.type === 'rename-entry') return state.entry.url;
    return '';
  });
  const [categoryValue, setCategoryValue] = useState(() => {
    if (state?.type === 'rename-entry') return state.entry.category ?? '';
    return '';
  });
  const [descValue, setDescValue] = useState(() => {
    if (state?.type === 'rename-entry') return state.entry.description ?? '';
    return '';
  });
  const inputRef = useRef<HTMLInputElement>(null);

  if (!state) return null;

  if (state.type === 'color-folder') {
    const current = state.folder.color || '#6366f1';
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent
          className="max-w-[280px]"
          onOpenAutoFocus={(e) => { e.preventDefault(); }}
        >
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
            <button
              className="px-2.5 py-1 rounded text-xs text-white/60 hover:bg-white/10 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
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
    state.type === 'add-entry' ? 'Add Bookmark' :
    state.type === 'rename-entry' ? 'Edit Bookmark' : 'Delete Bookmark';

  const confirm = () => {
    if (!state) return;
    if (state.type === 'new-folder' && value.trim()) onCreate(state.boardId, value.trim(), state.parentId);
    else if (state.type === 'rename-folder' && value.trim()) onRename(state.folder.id, value.trim());
    else if (state.type === 'delete-folder') onDelete(state.folder.id);
    else if (state.type === 'add-entry' && urlValue.trim()) onAddEntry(state.categoryId, value.trim(), urlValue.trim(), categoryValue.trim() || undefined, descValue.trim() || undefined);
    else if (state.type === 'rename-entry') onRenameEntry(state.entry.id, value.trim(), urlValue.trim(), categoryValue.trim() || undefined, descValue.trim() || undefined);
    else if (state.type === 'delete-entry') onDeleteEntry(state.entry.id);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-[320px]"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>

        {isDelete ? (
          <p className="text-xs text-white/60">
            {state.type === 'delete-folder'
              ? `Delete "${state.folder.name}" and all its contents?`
              : `Delete "${state.entry.title || state.entry.url}"?`
            }
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(state.type === 'add-entry' || state.type === 'rename-entry') && (
              <>
                <Input
                  placeholder="Title (optional)"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  ref={inputRef}
                  placeholder="https://example.com"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  placeholder="Category (e.g. Work, Dev)"
                  value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  placeholder="Description (optional note)"
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                  className="text-xs h-8"
                />
              </>
            )}
            {(state.type === 'new-folder' || state.type === 'rename-folder') && (
              <Input
                ref={inputRef}
                placeholder="Folder name"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                className="text-xs h-8"
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-1.5 mt-1">
          <button
            className="px-2.5 py-1 rounded text-xs text-white/60 hover:bg-white/10 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isDelete ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            onClick={confirm}
          >
            {isDelete ? 'Delete' : 'Confirm'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Entry Item ───────────────────────────────────────────────────────────────

function EntryItem({
  entry,
  onDialog,
}: { entry: BookmarkEntry; onDialog: (d: DialogState) => void }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors text-left group"
          onDoubleClick={() => window.open(entry.url, '_blank', 'noopener')}
          title={entry.url}
        >
          {entry.favIconUrl ? (
            <img
              src={entry.favIconUrl}
              alt=""
              className="w-3.5 h-3.5 shrink-0 rounded-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <Bookmark size={12} className="shrink-0 opacity-40" style={{ color: 'var(--color-text)' }} />
          )}
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="block truncate text-xs leading-tight" style={{ color: 'var(--color-text)' }}>
                {entry.title || entry.url}
              </span>
              {entry.category && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                  <Tag size={7} />
                  {entry.category}
                </span>
              )}
            </span>
            {entry.description ? (
              <span className="block truncate text-[10px] leading-tight opacity-50 mt-px" style={{ color: 'var(--color-text)' }}>
                {entry.description}
              </span>
            ) : (
              <span className="block truncate text-[10px] leading-tight opacity-40" style={{ color: 'var(--color-text)' }}>
                {entry.url}
              </span>
            )}
          </span>
          <ExternalLink
            size={11}
            className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"
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
        <ContextMenuItem onClick={() => onDialog({ type: 'rename-entry', entry })}>
          <Pencil size={12} className="mr-2" /> Rename
        </ContextMenuItem>
        <ContextMenuItem destructive onClick={() => onDialog({ type: 'delete-entry', entry })}>
          <Trash2 size={12} className="mr-2" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Folder Row (accordion) ───────────────────────────────────────────────────

interface FolderRowProps {
  folder: BookmarkCategory;
  depth: number;
  allCategories: BookmarkCategory[];
  getEntries: (id: string) => BookmarkEntry[];
  onDialog: (d: DialogState) => void;
  saveTabToFolder: (id: string) => Promise<void>;
}

function FolderRow({ folder, depth, allCategories, getEntries, onDialog, saveTabToFolder }: FolderRowProps) {
  const [open, setOpen] = useState(false);
  const entries = getEntries(folder.id);
  const subFolders = allCategories.filter((c) => c.parentCategoryId === folder.id);
  const folderColor = folder.color || '#f59e0b';

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors text-left"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center opacity-40">
              {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </span>
            {/* Color dot */}
            <span
              className="shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: folderColor }}
            />
            <span className="shrink-0" style={{ color: folderColor }}>
              {open ? <FolderOpen size={13} /> : <Folder size={13} />}
            </span>
            <span
              className="flex-1 truncate text-xs font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              {folder.name}
            </span>
            <span className="text-[10px] opacity-30 shrink-0" style={{ color: 'var(--color-text)' }}>
              {entries.length}
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onDialog({ type: 'new-folder', boardId: folder.boardId, parentId: folder.id })}>
            <FolderPlus size={12} className="mr-2" /> New Sub-Folder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDialog({ type: 'add-entry', categoryId: folder.id })}>
            <Plus size={12} className="mr-2" /> Add Bookmark
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void saveTabToFolder(folder.id)}>
            <Save size={12} className="mr-2" /> Save Current Tab Here
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDialog({ type: 'rename-folder', folder })}>
            <Pencil size={12} className="mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDialog({ type: 'color-folder', folder })}>
            <Palette size={12} className="mr-2" /> Change Color
          </ContextMenuItem>
          <ContextMenuItem destructive onClick={() => onDialog({ type: 'delete-folder', folder })}>
            <Trash2 size={12} className="mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {open && (
        <div>
          {subFolders.map((sf) => (
            <FolderRow
              key={sf.id}
              folder={sf}
              depth={depth + 1}
              allCategories={allCategories}
              getEntries={getEntries}
              onDialog={onDialog}
              saveTabToFolder={saveTabToFolder}
            />
          ))}
          {entries.map((entry) => (
            <div key={entry.id} style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}>
              <EntryItem entry={entry} onDialog={onDialog} />
            </div>
          ))}
          {subFolders.length === 0 && entries.length === 0 && (
            <p
              className="text-[10px] italic py-1 opacity-40"
              style={{ paddingLeft: `${24 + (depth + 1) * 14}px`, color: 'var(--color-text)' }}
            >
              Empty folder
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function BookmarksPanel() {
  const data = useBookmarkFolderData();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedFolderForSave, setSelectedFolderForSave] = useState<string | null>(null);

  const handleSaveCurrentTab = useCallback(async (folderId?: string) => {
    const id = folderId ?? selectedFolderForSave;
    if (!id) {
      setSaveStatus('Right-click a folder and choose "Save Current Tab Here"');
      setTimeout(() => setSaveStatus(null), TOAST_DISMISS_MS);
      return;
    }
    const entry = await data.saveCurrentTab(id);
    if (entry) {
      setSaveStatus(`Saved: ${entry.title || entry.url}`);
    } else {
      setSaveStatus('Could not get current tab');
    }
    setTimeout(() => setSaveStatus(null), TOAST_DISMISS_MS);
  }, [data, selectedFolderForSave]);

  const handleCreate = async (boardId: string, name: string, parentId?: string) => {
    if (parentId) {
      await data.createSubFolder(parentId, name, boardId);
    } else {
      await data.createTopLevelFolder(boardId, name);
    }
  };

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 opacity-50" style={{ color: 'var(--color-text)' }}>
        <RefreshCw size={14} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="p-4 text-sm text-red-400">{data.error}</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Bookmarks
        </span>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
          onClick={() => void handleSaveCurrentTab()}
          title="Save current tab to the last used folder"
        >
          <Save size={12} />
          Save Tab
        </button>
      </div>

      {/* Status message */}
      {saveStatus && (
        <div
          className="px-3 py-1.5 text-xs border-b"
          style={{
            color: saveStatus.startsWith('Saved') ? '#34a853' : 'var(--color-text-secondary)',
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          {saveStatus}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {data.boards.length === 0 ? (
          <p
            className="text-xs text-center py-6 opacity-50 italic"
            style={{ color: 'var(--color-text)' }}
          >
            No boards yet. Open the Start Tab to create boards and folders.
          </p>
        ) : (
          data.boards.map((board) => {
            const topLevel = data.categories.filter(
              (c) => c.boardId === board.id && !c.parentCategoryId,
            );
            return (
              <div key={board.id} className="py-1">
                {/* Board header */}
                <div
                  className="flex items-center justify-between px-3 py-1"
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest opacity-50 truncate"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {board.icon} {board.name}
                  </span>
                  <button
                    className="shrink-0 p-0.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors opacity-50 hover:opacity-100"
                    style={{ color: 'var(--color-text)' }}
                    title="New folder in this board"
                    onClick={() => setDialogState({ type: 'new-folder', boardId: board.id })}
                  >
                    <Plus size={11} />
                  </button>
                </div>

                {topLevel.length === 0 ? (
                  <p
                    className="px-6 py-1 text-[10px] italic opacity-40"
                    style={{ color: 'var(--color-text)' }}
                  >
                    No folders
                  </p>
                ) : (
                  topLevel.map((folder) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      depth={0}
                      allCategories={data.categories}
                      getEntries={data.getEntriesForCategory}
                      onDialog={setDialogState}
                      saveTabToFolder={async (id) => {
                        setSelectedFolderForSave(id);
                        await handleSaveCurrentTab(id);
                      }}
                    />
                  ))
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Dialog */}
      <BookmarkDialog
        state={dialogState}
        onClose={() => setDialogState(null)}
        onCreate={handleCreate}
        onRename={async (id, name) => { await data.renameFolder(id, name); }}
        onColorFolder={async (id, color) => { await data.updateFolderColor(id, color); }}
        onDelete={async (id) => { await data.deleteFolder(id); }}
        onAddEntry={async (categoryId, title, url, category, description) => { await data.addEntry(categoryId, title, url, category, description); }}
        onRenameEntry={async (id, title, url, category, description) => { await data.renameEntry(id, title, url, category, description); }}
        onDeleteEntry={async (id) => { await data.deleteEntry(id); }}
      />
    </div>
  );
}
