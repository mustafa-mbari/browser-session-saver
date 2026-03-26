import { useState } from 'react';
import {
  Home, Zap, LayoutList, Star, Monitor, Globe,
  Folder, FolderOpen, ChevronRight, ChevronDown,
  Plus, Pencil, Trash2, Check, X, ArrowRightLeft,
} from 'lucide-react';
import type { Prompt, PromptFolder, PromptsNavState, PromptSectionKey } from '@core/types/prompt.types';

// Predefined folder color palette (empty string = no color / default)
const FOLDER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '',
];

interface PromptSectionNavProps {
  prompts: Prompt[];
  folders: PromptFolder[];
  nav: PromptsNavState;
  onNavigate: (nav: PromptsNavState) => void;
  onCreateFolder: (name: string, parentId?: string, source?: 'local' | 'app') => Promise<PromptFolder>;
  onUpdateFolder: (id: string, updates: Partial<Pick<PromptFolder, 'name' | 'color'>>) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveFolder: (id: string, newParentId: string | undefined) => Promise<void>;
}

// ── Top utility sections ────────────────────────────────────────────────────

const TOP_SECTIONS: Array<{ key: PromptSectionKey; label: string; icon: React.ReactNode }> = [
  { key: 'start',        label: 'Start',     icon: <Home size={16} /> },
  { key: 'quick-access', label: 'Pinned',    icon: <Zap size={16} /> },
  { key: 'all',          label: 'All',       icon: <LayoutList size={16} /> },
  { key: 'favorites',    label: 'Favorites', icon: <Star size={16} /> },
];

// ── FolderTreeItem ──────────────────────────────────────────────────────────

function FolderTreeItem({
  folder,
  allFolders,
  prompts,
  source,
  activeFolderId,
  depth,
  readonly,
  onSelect,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveFolder,
}: {
  folder: PromptFolder;
  allFolders: PromptFolder[];
  prompts: Prompt[];
  source: 'local' | 'app';
  activeFolderId: string | undefined;
  depth: number;
  readonly?: boolean;
  onSelect: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string, source?: 'local' | 'app') => Promise<PromptFolder>;
  onUpdateFolder: (id: string, updates: Partial<Pick<PromptFolder, 'name' | 'color'>>) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveFolder: (id: string, newParentId: string | undefined) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [renameColor, setRenameColor] = useState<string>(folder.color ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [moving, setMoving] = useState(false);

  const children = allFolders
    .filter((f) => f.parentId === folder.id)
    .sort((a, b) => a.position - b.position);

  const isActive = activeFolderId === folder.id;
  const promptCount = prompts.filter(
    (p) => p.source === source && p.folderId === folder.id,
  ).length;

  // Collect all descendant IDs (used to exclude from move targets)
  const getDescendantIds = (id: string): Set<string> => {
    const result = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.add(current);
      allFolders.filter((f) => f.parentId === current).forEach((f) => queue.push(f.id));
    }
    return result;
  };

  // Valid move targets: all folders except self and descendants
  const moveTargets = allFolders.filter((f) => {
    const descendants = getDescendantIds(folder.id);
    return !descendants.has(f.id);
  });

  const handleRenameSubmit = async () => {
    const name = renameName.trim();
    const colorVal = renameColor || undefined;
    if (name) {
      await onUpdateFolder(folder.id, {
        name: name !== folder.name ? name : folder.name,
        color: colorVal,
      });
    }
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await onDeleteFolder(folder.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleAddChild = async () => {
    const name = newChildName.trim();
    if (!name) return;
    await onCreateFolder(name, folder.id, source);
    setNewChildName('');
    setAddingChild(false);
    setExpanded(true);
  };

  const handleMove = async (newParentId: string | undefined) => {
    await onMoveFolder(folder.id, newParentId);
    setMoving(false);
  };

  const FolderIcon = expanded && children.length > 0 ? FolderOpen : Folder;
  const indentPx = depth * 12 + 8;

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-1.5 rounded-lg cursor-pointer select-none transition-colors ${
          isActive
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
        }`}
        style={{ paddingLeft: `${indentPx}px`, paddingRight: '6px' }}
        onClick={() => {
          onSelect(folder.id);
          if (children.length > 0) setExpanded((v) => !v);
        }}
      >
        {/* Expand chevron */}
        <span
          className="shrink-0 w-3 flex justify-center opacity-50"
          onClick={(e) => { e.stopPropagation(); if (children.length > 0) setExpanded((v) => !v); }}
        >
          {children.length > 0
            ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)
            : null}
        </span>

        {/* Folder icon */}
        <FolderIcon
          size={13}
          className="shrink-0"
          style={{ color: folder.color ?? 'currentColor' }}
        />

        {/* Name / rename input */}
        {renaming ? (
          <input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void handleRenameSubmit(); }
              if (e.key === 'Escape') { setRenaming(false); setRenameName(folder.name); setRenameColor(folder.color ?? ''); }
            }}
            onBlur={() => void handleRenameSubmit()}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-xs bg-transparent border-b border-amber-400 outline-none text-[var(--color-text)]"
          />
        ) : (
          <span className="flex-1 min-w-0 text-xs truncate" title={folder.name}>
            {folder.name}
          </span>
        )}

        {/* Count */}
        {!renaming && promptCount > 0 && (
          <span className="text-xs opacity-40 shrink-0 tabular-nums">{promptCount}</span>
        )}

        {/* Hover actions — only shown when not readonly */}
        {!renaming && !readonly && (
          <span
            className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAddingChild(true)}
              className="p-0.5 rounded hover:bg-amber-500/20 text-[var(--color-text-secondary)] hover:text-amber-500 transition-colors"
              title="Add sub-folder"
            >
              <Plus size={10} />
            </button>
            <button
              onClick={() => { setRenaming(true); setRenameName(folder.name); setRenameColor(folder.color ?? ''); }}
              className="p-0.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors"
              title="Rename / change color"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={() => setMoving((v) => !v)}
              className="p-0.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors"
              title="Move folder"
            >
              <ArrowRightLeft size={10} />
            </button>
            <button
              onClick={() => void handleDelete()}
              className={`p-0.5 rounded transition-colors ${
                confirmDelete
                  ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'text-[var(--color-text-secondary)] hover:text-red-500'
              }`}
              title={confirmDelete ? 'Click again to confirm' : 'Delete folder'}
            >
              {confirmDelete ? <Check size={10} /> : <Trash2 size={10} />}
            </button>
          </span>
        )}
      </div>

      {/* Color picker (shown during rename) */}
      {renaming && (
        <div
          className="flex items-center gap-1 py-1 flex-wrap"
          style={{ paddingLeft: `${indentPx + 16}px`, paddingRight: '6px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {FOLDER_COLORS.map((c) => (
            <button
              key={c === '' ? 'none' : c}
              type="button"
              title={c === '' ? 'No color' : c}
              onMouseDown={(e) => { e.preventDefault(); setRenameColor(c); }}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                renameColor === c ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c === '' ? 'transparent' : c, outline: c === '' ? '1px solid var(--color-border)' : undefined }}
            />
          ))}
        </div>
      )}

      {/* Move target list */}
      {moving && !readonly && (
        <div
          className="py-1 space-y-0.5"
          style={{ paddingLeft: `${indentPx + 16}px`, paddingRight: '6px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-[var(--color-text-secondary)] opacity-60 mb-1">Move to:</p>
          <button
            onClick={() => void handleMove(undefined)}
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-amber-500/15 hover:text-amber-600 text-[var(--color-text-secondary)] transition-colors"
          >
            Root level
          </button>
          {moveTargets.map((t) => (
            <button
              key={t.id}
              onClick={() => void handleMove(t.id)}
              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-amber-500/15 hover:text-amber-600 text-[var(--color-text-secondary)] transition-colors truncate"
            >
              <Folder size={10} className="inline mr-1" style={{ color: t.color ?? 'currentColor' }} />
              {t.name}
            </button>
          ))}
          <button
            onClick={() => setMoving(false)}
            className="w-full text-left text-xs px-2 py-1 rounded text-[var(--color-text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Inline add-child input */}
      {addingChild && !readonly && (
        <div
          className="flex items-center gap-1.5 py-1"
          style={{ paddingLeft: `${indentPx + 16}px`, paddingRight: '6px' }}
        >
          <Folder size={11} className="shrink-0 text-[var(--color-text-secondary)]" />
          <input
            autoFocus
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void handleAddChild(); }
              if (e.key === 'Escape') { setAddingChild(false); setNewChildName(''); }
            }}
            placeholder="Sub-folder name…"
            className="flex-1 text-xs bg-transparent border-b border-amber-400 outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]"
          />
          <button onClick={() => void handleAddChild()} className="p-0.5 text-amber-500 hover:text-amber-600">
            <Check size={10} />
          </button>
          <button onClick={() => { setAddingChild(false); setNewChildName(''); }} className="p-0.5 text-[var(--color-text-secondary)]">
            <X size={10} />
          </button>
        </div>
      )}

      {/* Children (recursive) */}
      {expanded && children.map((child) => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          allFolders={allFolders}
          prompts={prompts}
          source={source}
          activeFolderId={activeFolderId}
          depth={depth + 1}
          readonly={readonly}
          onSelect={onSelect}
          onCreateFolder={onCreateFolder}
          onUpdateFolder={onUpdateFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveFolder={onMoveFolder}
        />
      ))}
    </div>
  );
}

// ── SourceSection — "MY PROMPTS" / "APP PROMPTS" ────────────────────────────

function SourceSection({
  source,
  label,
  icon,
  prompts,
  folders,
  nav,
  readonly,
  onNavigate,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveFolder,
}: {
  source: 'local' | 'app';
  label: string;
  icon: React.ReactNode;
  prompts: Prompt[];
  folders: PromptFolder[];
  nav: PromptsNavState;
  readonly?: boolean;
  onNavigate: (nav: PromptsNavState) => void;
  onCreateFolder: (name: string, parentId?: string, source?: 'local' | 'app') => Promise<PromptFolder>;
  onUpdateFolder: (id: string, updates: Partial<Pick<PromptFolder, 'name' | 'color'>>) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveFolder: (id: string, newParentId: string | undefined) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  const isSourceActive = nav.kind === 'source' && nav.source === source && !nav.folderId;
  const activeFolderId =
    nav.kind === 'source' && nav.source === source ? nav.folderId : undefined;

  const totalCount = prompts.filter((p) => p.source === source).length;
  // Only show folders belonging to this source section
  const sourceFolders = folders.filter((f) => f.source === source);
  const rootFolders = sourceFolders
    .filter((f) => !f.parentId)
    .sort((a, b) => a.position - b.position);

  const handleAddRootFolder = async () => {
    const name = newRootName.trim();
    if (!name) return;
    await onCreateFolder(name, undefined, source);
    setNewRootName('');
    setAddingRoot(false);
    setExpanded(true);
  };

  return (
    <div className="mb-1">
      {/* Section header row */}
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isSourceActive
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
        }`}
        onClick={() => onNavigate({ kind: 'source', source })}
      >
        {/* Collapse toggle */}
        <span
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        {/* Icon */}
        <span className="shrink-0">{icon}</span>

        {/* Label */}
        <span className={`flex-1 text-xs font-semibold truncate ${isSourceActive ? '' : 'opacity-80'}`}>
          {label}
        </span>

        {/* Total count */}
        {totalCount > 0 && (
          <span className={`text-xs shrink-0 tabular-nums ${isSourceActive ? 'text-amber-500' : 'opacity-40'}`}>
            {totalCount}
          </span>
        )}

        {/* + New folder button — hidden when readonly */}
        {!readonly && (
          <button
            onClick={(e) => { e.stopPropagation(); setAddingRoot(true); setExpanded(true); }}
            className="hidden group-hover:flex shrink-0 p-0.5 rounded hover:bg-amber-500/15 hover:text-amber-500 text-[var(--color-text-secondary)] transition-colors"
            title={`New folder in ${label}`}
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {/* New root folder inline input */}
          {addingRoot && !readonly && (
            <div className="flex items-center gap-1.5 py-1 pl-8 pr-2">
              <Folder size={12} className="shrink-0 text-[var(--color-text-secondary)]" />
              <input
                autoFocus
                value={newRootName}
                onChange={(e) => setNewRootName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleAddRootFolder(); }
                  if (e.key === 'Escape') { setAddingRoot(false); setNewRootName(''); }
                }}
                placeholder="Folder name…"
                className="flex-1 text-xs bg-transparent border-b border-amber-400 outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]"
              />
              <button onClick={() => void handleAddRootFolder()} className="p-0.5 text-amber-500 hover:text-amber-600">
                <Check size={10} />
              </button>
              <button
                onClick={() => { setAddingRoot(false); setNewRootName(''); }}
                className="p-0.5 text-[var(--color-text-secondary)]"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {/* Empty hint */}
          {rootFolders.length === 0 && !addingRoot && !readonly && (
            <p className="pl-6 py-1 text-xs text-[var(--color-text-secondary)] opacity-40 italic">
              Click + to create a folder
            </p>
          )}

          {/* Folder tree */}
          {rootFolders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              allFolders={sourceFolders}
              prompts={prompts}
              source={source}
              activeFolderId={activeFolderId}
              depth={0}
              readonly={readonly}
              onSelect={(id) => onNavigate({ kind: 'source', source, folderId: id })}
              onCreateFolder={onCreateFolder}
              onUpdateFolder={onUpdateFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── PromptSectionNav ────────────────────────────────────────────────────────

export default function PromptSectionNav({
  prompts,
  folders,
  nav,
  onNavigate,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveFolder,
}: PromptSectionNavProps) {
  return (
    <nav className="flex flex-col h-full overflow-y-auto py-2 px-1.5 select-none">
      {/* ── Top 4 utility sections ───────────────────────────── */}
      <div className="space-y-0.5 mb-3">
        {TOP_SECTIONS.map(({ key, label, icon }) => {
          const isActive = nav.kind === 'section' && nav.key === key;
          const count = (() => {
            if (key === 'start') return prompts.filter((p) => p.lastUsedAt).length;
            if (key === 'quick-access') return prompts.filter((p) => p.isPinned).length;
            if (key === 'all') return prompts.length;
            if (key === 'favorites') return prompts.filter((p) => p.isFavorite).length;
            return 0;
          })();
          return (
            <button
              key={key}
              onClick={() => onNavigate({ kind: 'section', key })}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                isActive
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
              }`}
            >
              <span className="shrink-0">{icon}</span>
              <span className="flex-1 text-left truncate">{label}</span>
              {count > 0 && (
                <span className={`text-xs shrink-0 tabular-nums ${isActive ? 'text-amber-500' : 'opacity-40'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-1 mb-3 border-t border-[var(--color-border)]" />

      {/* ── MY PROMPTS (local) ───────────────────────────────── */}
      <SourceSection
        source="local"
        label="My Prompts"
        icon={<Monitor size={15} />}
        prompts={prompts}
        folders={folders}
        nav={nav}
        onNavigate={onNavigate}
        onCreateFolder={onCreateFolder}
        onUpdateFolder={onUpdateFolder}
        onDeleteFolder={onDeleteFolder}
        onMoveFolder={onMoveFolder}
      />

      {/* Divider */}
      <div className="mx-1 my-2 border-t border-[var(--color-border)]" />

      {/* ── APP PROMPTS (read-only) ───────────────────────────── */}
      <SourceSection
        source="app"
        label="App Prompts"
        icon={<Globe size={15} />}
        prompts={prompts}
        folders={folders}
        nav={nav}
        readonly
        onNavigate={onNavigate}
        onCreateFolder={onCreateFolder}
        onUpdateFolder={onUpdateFolder}
        onDeleteFolder={onDeleteFolder}
        onMoveFolder={onMoveFolder}
      />
    </nav>
  );
}
