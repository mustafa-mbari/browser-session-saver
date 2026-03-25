import { useState } from 'react';
import {
  Home, Zap, LayoutList, Star, Monitor, Globe,
  Folder, FolderOpen, ChevronRight, ChevronDown,
  Plus, Pencil, Trash2, Check, X,
} from 'lucide-react';
import type { Prompt, PromptFolder, PromptsNavState, PromptSectionKey } from '@core/types/prompt.types';

interface PromptSectionNavProps {
  prompts: Prompt[];
  folders: PromptFolder[];
  nav: PromptsNavState;
  onNavigate: (nav: PromptsNavState) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

// ── Top utility sections ────────────────────────────────────────────────────

const TOP_SECTIONS: Array<{ key: PromptSectionKey; label: string; icon: React.ReactNode }> = [
  { key: 'start',        label: 'Start',     icon: <Home size={14} /> },
  { key: 'quick-access', label: 'Pinned',    icon: <Zap size={14} /> },
  { key: 'all',          label: 'All',       icon: <LayoutList size={14} /> },
  { key: 'favorites',    label: 'Favorites', icon: <Star size={14} /> },
];

// ── FolderTreeItem ──────────────────────────────────────────────────────────

function FolderTreeItem({
  folder,
  allFolders,
  prompts,
  source,
  activeFolderId,
  depth,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: PromptFolder;
  allFolders: PromptFolder[];
  prompts: Prompt[];
  source: 'local' | 'app';
  activeFolderId: string | undefined;
  depth: number;
  onSelect: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

  const children = allFolders
    .filter((f) => f.parentId === folder.id)
    .sort((a, b) => a.position - b.position);

  const isActive = activeFolderId === folder.id;
  // Count only direct prompts from this source in this folder (recursive descendants for badge)
  const promptCount = prompts.filter(
    (p) => p.source === source && p.folderId === folder.id,
  ).length;

  const handleRenameSubmit = async () => {
    const name = renameName.trim();
    if (name && name !== folder.name) await onRenameFolder(folder.id, name);
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
    await onCreateFolder(name, folder.id);
    setNewChildName('');
    setAddingChild(false);
    setExpanded(true);
  };

  const FolderIcon = expanded && children.length > 0 ? FolderOpen : Folder;
  const indentPx = depth * 10 + 8;

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
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={() => void handleRenameSubmit()}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-sm bg-transparent border-b border-amber-400 outline-none text-[var(--color-text)]"
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm truncate" title={folder.name}>
            {folder.name}
          </span>
        )}

        {/* Count */}
        {!renaming && promptCount > 0 && (
          <span className="text-xs opacity-40 shrink-0 tabular-nums">{promptCount}</span>
        )}

        {/* Hover actions */}
        {!renaming && (
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
              onClick={() => { setRenaming(true); setRenameName(folder.name); }}
              className="p-0.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors"
              title="Rename"
            >
              <Pencil size={10} />
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

      {/* Inline add-child input */}
      {addingChild && (
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
          onSelect={onSelect}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
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
  onNavigate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  source: 'local' | 'app';
  label: string;
  icon: React.ReactNode;
  prompts: Prompt[];
  folders: PromptFolder[];
  nav: PromptsNavState;
  onNavigate: (nav: PromptsNavState) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  const isSourceActive = nav.kind === 'source' && nav.source === source && !nav.folderId;
  const activeFolderId =
    nav.kind === 'source' && nav.source === source ? nav.folderId : undefined;

  const totalCount = prompts.filter((p) => p.source === source).length;
  const rootFolders = folders
    .filter((f) => !f.parentId)
    .sort((a, b) => a.position - b.position);

  const handleAddRootFolder = async () => {
    const name = newRootName.trim();
    if (!name) return;
    await onCreateFolder(name);
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
        <span className={`flex-1 text-sm font-semibold truncate ${
          isSourceActive ? '' : 'opacity-80'
        }`}>
          {label}
        </span>

        {/* Total count */}
        {totalCount > 0 && (
          <span className={`text-xs shrink-0 tabular-nums ${isSourceActive ? 'text-amber-500' : 'opacity-40'}`}>
            {totalCount}
          </span>
        )}

        {/* + New folder button */}
        <button
          onClick={(e) => { e.stopPropagation(); setAddingRoot(true); setExpanded(true); }}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-amber-500/15 hover:text-amber-500 text-[var(--color-text-secondary)] transition-all"
          title={`New folder in ${label}`}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {/* New root folder inline input */}
          {addingRoot && (
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
          {rootFolders.length === 0 && !addingRoot && (
            <p className="pl-6 py-1 text-xs text-[var(--color-text-secondary)] opacity-40 italic">
              Click + to create a folder
            </p>
          )}

          {/* Folder tree */}
          {rootFolders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              allFolders={folders}
              prompts={prompts}
              source={source}
              activeFolderId={activeFolderId}
              depth={0}
              onSelect={(id) => onNavigate({ kind: 'source', source, folderId: id })}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
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
  onRenameFolder,
  onDeleteFolder,
}: PromptSectionNavProps) {
  return (
    <nav className="flex flex-col h-full overflow-y-auto py-2 px-1 select-none">
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
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
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
        icon={<Monitor size={13} />}
        prompts={prompts}
        folders={folders}
        nav={nav}
        onNavigate={onNavigate}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
      />

      {/* Divider */}
      <div className="mx-1 my-2 border-t border-[var(--color-border)]" />

      {/* ── APP PROMPTS ──────────────────────────────────────── */}
      <SourceSection
        source="app"
        label="App Prompts"
        icon={<Globe size={13} />}
        prompts={prompts}
        folders={folders}
        nav={nav}
        onNavigate={onNavigate}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
      />
    </nav>
  );
}
