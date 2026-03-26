import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Search, Copy, Check, Pencil, Trash2, ArrowRightLeft,
  Pin, PinOff, Star, ChevronDown, ChevronUp, Zap, X, Sparkles, Cpu,
  Home, LayoutList, Zap as ZapIcon, Star as StarIcon, Monitor, Globe, Folder, FolderOpen,
  ChevronRight, ChevronDown as ChevronDownIcon,
} from 'lucide-react';

const DEFAULT_MODELS = ['GPT-4o', 'Claude 3.5', 'Gemini 1.5', 'Llama 3'];

// ── Model multi-select dropdown (glassmorphism variant) ─────────────────────
function ModelSelectDropdown({
  models, selected, onToggle, newName, setNewName, onAdd,
}: {
  models: string[];
  selected: string[];
  onToggle: (m: string) => void;
  newName: string;
  setNewName: (v: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border border-white/15 bg-white/5 hover:border-amber-400/40 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
        style={{ color: 'var(--newtab-text)' }}
      >
        <span className="truncate text-left">
          {selected.length === 0
            ? <span style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}>No models selected</span>
            : selected.join(', ')}
        </span>
        <ChevronDownIcon size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--newtab-text-secondary)' }} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-white/20 bg-black/70 backdrop-blur-md shadow-2xl overflow-hidden">
          {models.map((model) => (
            <button
              key={model}
              type="button"
              onClick={() => onToggle(model)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors text-left"
              style={{ color: 'var(--newtab-text)' }}
            >
              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                selected.includes(model) ? 'bg-amber-500 border-amber-500' : 'border-white/30'
              }`}>
                {selected.includes(model) && <Check size={8} className="text-white" strokeWidth={3} />}
              </div>
              {model}
            </button>
          ))}
          <div className="border-t border-white/10" />
          <div className="flex gap-1 p-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
              placeholder="Add custom model…"
              className="flex-1 px-2 py-1 text-xs rounded border border-white/15 bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:opacity-30"
              style={{ color: 'var(--newtab-text)' }}
            />
            <button onClick={onAdd} disabled={!newName.trim()} className="px-2 py-1 text-xs rounded bg-amber-500/80 text-white hover:bg-amber-500 disabled:opacity-30 transition-colors">+</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Folder picker dropdown (glassmorphism variant) ───────────────────────────
function flattenFolders(
  allFolders: PromptFolder[],
  parentId?: string,
  depth = 0,
): Array<{ folder: PromptFolder; depth: number }> {
  const children = allFolders
    .filter((f) => (f.parentId ?? undefined) === parentId)
    .sort((a, b) => a.position - b.position);
  return children.flatMap((f) => [{ folder: f, depth }, ...flattenFolders(allFolders, f.id, depth + 1)]);
}

function FolderPickerDropdown({
  folders,
  value,
  onChange,
  onCreateFolder,
}: {
  folders: PromptFolder[];
  value: string;
  onChange: (id: string) => void;
  onCreateFolder?: (name: string) => Promise<PromptFolder>;
}) {
  const [open, setOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedFolder = folders.find((f) => f.id === value);
  const flatList = flattenFolders(folders);

  const handleCreate = async () => {
    const name = newFolderName.trim();
    if (!name || !onCreateFolder) return;
    const folder = await onCreateFolder(name);
    onChange(folder.id);
    setNewFolderName('');
    setCreatingFolder(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border border-white/15 bg-white/5 hover:border-amber-400/40 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
        style={{ color: 'var(--newtab-text)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Folder size={11} className="shrink-0 opacity-50" style={selectedFolder?.color ? { color: selectedFolder.color } : {}} />
          <span className="truncate">
            {selectedFolder
              ? selectedFolder.name
              : <span style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}>No folder</span>}
          </span>
        </div>
        <ChevronDownIcon size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--newtab-text-secondary)' }} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-white/20 bg-black/80 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors text-left"
            >
              <div className={`w-3 h-3 rounded-full border shrink-0 transition-colors ${value === '' ? 'bg-amber-500 border-amber-500' : 'border-white/30'}`} />
              <span className="italic opacity-50" style={{ color: 'var(--newtab-text-secondary)' }}>No folder</span>
            </button>
            {flatList.map(({ folder, depth }) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => { onChange(folder.id); setOpen(false); }}
                className="w-full flex items-center gap-2 py-1.5 text-xs hover:bg-white/10 transition-colors text-left pr-3"
                style={{ paddingLeft: `${depth * 12 + 12}px`, color: 'var(--newtab-text)' }}
              >
                <div className={`w-3 h-3 rounded-full border shrink-0 transition-colors ${value === folder.id ? 'bg-amber-500 border-amber-500' : 'border-white/30'}`} />
                <Folder size={10} className="shrink-0" style={{ color: folder.color ?? undefined }} />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </div>
          {onCreateFolder && (
            <>
              <div className="border-t border-white/10" />
              {creatingFolder ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void handleCreate(); }
                      if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
                    }}
                    placeholder="Folder name…"
                    className="flex-1 px-2 py-0.5 text-[10px] rounded border border-amber-400/50 bg-white/5 focus:outline-none"
                    style={{ color: 'var(--newtab-text)' }}
                  />
                  <button onClick={() => void handleCreate()} disabled={!newFolderName.trim()} className="p-1 text-amber-400 disabled:opacity-30">
                    <Check size={9} />
                  </button>
                  <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="p-1 opacity-50" style={{ color: 'var(--newtab-text-secondary)' }}>
                    <X size={9} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingFolder(true)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:bg-white/10 transition-colors"
                  style={{ color: 'var(--newtab-text-secondary)' }}
                >
                  <Plus size={10} /> New folder
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category picker dropdown (glassmorphism variant) ─────────────────────────
function CategoryPickerDropdown({
  categories,
  value,
  onChange,
}: {
  categories: PromptCategory[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = categories.find((c) => c.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border border-white/15 bg-white/5 hover:border-amber-400/40 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
        style={{ color: 'var(--newtab-text)' }}
      >
        <span className="truncate">
          {selected
            ? <span>{selected.icon} {selected.name}</span>
            : <span style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}>No category</span>}
        </span>
        <ChevronDownIcon size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--newtab-text-secondary)' }} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-white/20 bg-black/80 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors text-left"
            >
              <div className={`w-3 h-3 rounded-full border shrink-0 transition-colors ${value === '' ? 'bg-amber-500 border-amber-500' : 'border-white/30'}`} />
              <span className="italic opacity-50" style={{ color: 'var(--newtab-text-secondary)' }}>No category</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { onChange(cat.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors text-left"
                style={{ color: 'var(--newtab-text)' }}
              >
                <div className={`w-3 h-3 rounded-full border shrink-0 transition-colors ${value === cat.id ? 'bg-amber-500 border-amber-500' : 'border-white/30'}`} />
                <span>{cat.icon} {cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import type {
  Prompt, PromptCategory, PromptFolder, PromptTag, PromptSortField, PromptsNavState,
  PromptSectionKey,
} from '@core/types/prompt.types';
import { PromptStorage } from '@core/storage/prompt-storage';
import { PromptService } from '@core/services/prompt.service';
import { generateId } from '@core/utils/uuid';

// ── CSS helpers ────────────────────────────────────────────────────────────
const T  = { color: 'var(--newtab-text)' } as React.CSSProperties;
const TS = { color: 'var(--newtab-text-secondary)' } as React.CSSProperties;

const FOLDER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '',
];

// ── Top utility section definitions ────────────────────────────────────────
const TOP_SECTIONS: Array<{ key: PromptSectionKey; label: string; icon: React.ReactNode }> = [
  { key: 'start',        label: 'Start',     icon: <Home size={14} /> },
  { key: 'quick-access', label: 'Pinned',    icon: <ZapIcon size={14} /> },
  { key: 'all',          label: 'All',       icon: <LayoutList size={14} /> },
  { key: 'favorites',    label: 'Favorites', icon: <StarIcon size={14} /> },
];

// ── Prompt row card ─────────────────────────────────────────────────────────
function PanelPromptCard({
  prompt,
  tags,
  folders = [],
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onCopy,
  onUse,
}: {
  prompt: Prompt;
  tags: PromptTag[];
  folders?: PromptFolder[];
  onEdit: (p: Prompt) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCopy: (id: string) => void;
  onUse: (p: Prompt) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const promptTags = tags.filter((t) => prompt.tags.includes(t.id));
  const hasVars = PromptService.extractVariables(prompt.content).length > 0;

  const folderPath = useMemo(() => {
    if (!prompt.folderId) return [];
    const path: string[] = [];
    let current = folders.find((f) => f.id === prompt.folderId);
    while (current) {
      path.unshift(current.name);
      current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
    }
    return path;
  }, [prompt.folderId, folders]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(prompt.content);
    onCopy(prompt.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) { onDelete(prompt.id); }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
  };

  return (
    <div className={`rounded-xl border glass mb-2 ${prompt.isPinned ? 'border-amber-400/40' : 'border-white/10'}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-2.5"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {prompt.isPinned && <Pin size={12} className="text-amber-400 shrink-0" />}
            <span className="text-base font-semibold truncate min-w-0" style={T}>{prompt.title}</span>
            {prompt.isFavorite && <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />}
            {/* Folder path */}
            {folderPath.length > 0 && (
              <span
                className="ml-auto shrink-0 text-[10px] truncate max-w-[40%] text-right opacity-60"
                style={TS}
                title={folderPath.join(' / ')}
              >
                {folderPath.join(' / ')}
              </span>
            )}
            {/* Source badge */}
            <span className={`${folderPath.length === 0 ? 'ml-auto' : ''} shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
              prompt.source === 'app'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-white/10 text-white/50'
            }`}>
              {prompt.source === 'app' ? 'App' : 'Local'}
            </span>
          </div>
          {!expanded && (
            <p className="text-sm truncate leading-snug" style={TS}>{prompt.content}</p>
          )}
          {promptTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {promptTags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="shrink-0 mt-0.5" style={TS}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-white/10">
          <div className="mt-3 rounded-lg bg-white/5 p-3">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed" style={T}>{prompt.content}</p>
          </div>
          {hasVars && (
            <p className="text-xs text-amber-400 font-medium">⚡ Contains variables — use "Fill & Copy" to fill them in</p>
          )}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={(e) => void handleCopy(e)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/80 text-white hover:bg-amber-500 transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {hasVars && (
              <button
                onClick={(e) => { e.stopPropagation(); onUse(prompt); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 transition-colors"
                style={T}
              >
                <Zap size={13} /> Fill & Copy
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(prompt); }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 transition-colors"
              style={TS}
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(prompt.id); }}
              className={`p-2 rounded-lg transition-colors ${prompt.isPinned ? 'text-amber-400 bg-amber-500/20' : 'bg-white/5 hover:bg-white/15'}`}
              style={prompt.isPinned ? undefined : TS}
              title={prompt.isPinned ? 'Unpin' : 'Pin'}
            >
              {prompt.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(prompt.id); }}
              className={`p-2 rounded-lg transition-colors ${prompt.isFavorite ? 'text-amber-400 bg-amber-500/20' : 'bg-white/5 hover:bg-white/15'}`}
              style={prompt.isFavorite ? undefined : TS}
              title={prompt.isFavorite ? 'Remove favorite' : 'Favorite'}
            >
              <Star size={13} className={prompt.isFavorite ? 'fill-amber-400' : ''} />
            </button>
            <button
              onClick={handleDelete}
              className={`ml-auto p-2 rounded-lg transition-colors ${confirmDelete ? 'text-red-400 bg-red-500/20' : 'bg-white/5 hover:bg-red-500/20 hover:text-red-400'}`}
              style={confirmDelete ? undefined : TS}
              title={confirmDelete ? 'Click to confirm delete' : 'Delete'}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline prompt form ──────────────────────────────────────────────────────
function InlinePromptForm({
  initial,
  categories,
  tags,
  folders,
  defaultFolderId,
  onSave,
  onCancel,
  onCreateFolder,
  onCreateTag,
}: {
  initial: Prompt | null;
  categories: PromptCategory[];
  tags: PromptTag[];
  folders: PromptFolder[];
  defaultFolderId?: string;
  defaultSource?: 'local' | 'app';
  onSave: (p: Prompt) => void;
  onCancel: () => void;
  onCreateFolder?: (name: string) => Promise<PromptFolder>;
  onCreateTag?: (name: string) => Promise<PromptTag>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [folderId, setFolderId] = useState(initial?.folderId ?? defaultFolderId ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initial?.tags ?? []);
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  // Tag creation
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Model compatibility
  const existingModels = initial?.compatibleModels ?? [];
  const allKnownModels = Array.from(new Set([...DEFAULT_MODELS, ...existingModels]));
  const [modelList, setModelList] = useState<string[]>(allKnownModels);
  const [compatibleModels, setCompatibleModels] = useState<string[]>(existingModels);
  const [newModelName, setNewModelName] = useState('');

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const detectedVars = PromptService.extractVariables(content);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const toggleModel = (model: string) => {
    setCompatibleModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  const handleAddCustomModel = () => {
    const name = newModelName.trim();
    if (!name || modelList.includes(name)) return;
    setModelList((prev) => [...prev, name]);
    setCompatibleModels((prev) => [...prev, name]);
    setNewModelName('');
  };

  const handleInsertVariable = () => {
    const el = contentRef.current;
    if (!el) { setContent((prev) => prev + '{{}}'); return; }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const newContent = content.slice(0, start) + '{{}}' + content.slice(end);
    setContent(newContent);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2);
    });
  };

  const handleCreateNewTag = async () => {
    const name = newTagName.trim();
    if (!name || !onCreateTag) return;
    const tag = await onCreateTag(name);
    setSelectedTagIds((prev) => [...prev, tag.id]);
    setNewTagName('');
    setAddingTag(false);
  };

  const handleSubmit = () => {
    const errs: { title?: string; content?: string } = {};
    if (!title.trim()) errs.title = 'Required';
    if (!content.trim()) errs.content = 'Required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? generateId(),
      title: title.trim(),
      content: content.trim(),
      categoryId: categoryId || undefined,
      folderId: folderId || undefined,
      source: initial?.source ?? 'local',
      tags: selectedTagIds,
      isFavorite: initial?.isFavorite ?? false,
      isPinned: initial?.isPinned ?? false,
      usageCount: initial?.usageCount ?? 0,
      lastUsedAt: initial?.lastUsedAt,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      compatibleModels: compatibleModels.length > 0 ? compatibleModels : undefined,
    });
  };

  const inputCls = 'w-full px-3 py-2.5 text-base rounded-lg border border-white/15 bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors placeholder:opacity-40';
  const localFolders = folders.filter((f) => f.source === 'local');

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" />
          <span className="text-base font-semibold" style={T}>{initial ? 'Edit Prompt' : 'New Prompt'}</span>
        </div>
        <button onClick={onCancel} className="p-1 rounded hover:bg-white/10" style={TS} aria-label="Cancel">
          <X size={13} />
        </button>
      </div>

      {/* Two-column body */}
      <div className="flex">
        {/* Left sidebar */}
        <div className="w-[32%] shrink-0 border-r border-white/10 px-4 py-4 space-y-4">

          {/* Folder */}
          <div>
            <p className="text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold" style={TS}>Folder</p>
            <FolderPickerDropdown
              folders={localFolders}
              value={folderId}
              onChange={setFolderId}
              onCreateFolder={onCreateFolder}
            />
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold" style={TS}>Category</p>
              <CategoryPickerDropdown
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
              />
            </div>
          )}

          {/* Model Compatibility */}
          <div>
            <p className="text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold flex items-center gap-1" style={TS}>
              <Cpu size={10} /> Model Compat
            </p>
            <ModelSelectDropdown
              models={modelList}
              selected={compatibleModels}
              onToggle={toggleModel}
              newName={newModelName}
              setNewName={setNewModelName}
              onAdd={handleAddCustomModel}
            />
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold" style={TS}>Tags</p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors"
                    style={
                      selectedTagIds.includes(tag.id)
                        ? { backgroundColor: tag.color, color: 'white', borderColor: 'transparent' }
                        : { borderColor: 'rgba(255,255,255,0.15)', ...TS }
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            {onCreateTag && (
              addingTag ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void handleCreateNewTag(); }
                      if (e.key === 'Escape') { setAddingTag(false); setNewTagName(''); }
                    }}
                    placeholder="Tag name…"
                    className="flex-1 px-2 py-1 text-xs rounded border border-amber-400/50 bg-white/5 focus:outline-none"
                    style={T}
                  />
                  <button onClick={() => void handleCreateNewTag()} disabled={!newTagName.trim()} className="p-1 text-amber-400 disabled:opacity-30">
                    <Check size={10} />
                  </button>
                  <button onClick={() => { setAddingTag(false); setNewTagName(''); }} className="p-1 opacity-50" style={TS}>
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTag(true)}
                  className="text-xs flex items-center gap-1 opacity-50 hover:opacity-80 hover:text-amber-400 transition-colors"
                  style={TS}
                >
                  <Plus size={10} /> New tag
                </button>
              )
            )}
          </div>
        </div>

        {/* Right: title + prompt text */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {/* PROMPT IDENTITY */}
          <div>
            <p className="text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold" style={TS}>Prompt Identity</p>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Python Architect Persona"
              className={inputCls}
              style={T}
            />
            {errors.title && <p className="text-sm text-red-400 mt-1">{errors.title}</p>}
          </div>

          {/* PROMPT TEXT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wide opacity-50 font-semibold" style={TS}>Prompt Text</p>
              <button
                type="button"
                onClick={handleInsertVariable}
                className="px-2 py-0.5 text-xs font-mono rounded border border-amber-400/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Insert variable placeholder"
              >
                {'{{}}'}
              </button>
            </div>
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'Enter instructions here...\n\nTip: use {{variable}} for dynamic values.'}
              rows={14}
              className={`${inputCls} resize-none font-mono`}
              style={T}
            />
            {errors.content && <p className="text-sm text-red-400 mt-1">{errors.content}</p>}
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs opacity-50" style={TS}>Variables:</span>
                {detectedVars.map((v) => (
                  <span key={v} className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono">
                    {'{{'}{v}{'}}'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-white/10">
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded-lg border border-white/15 text-sm hover:bg-white/10 transition-colors"
          style={TS}
        >
          Discard
        </button>
        <button
          onClick={handleSubmit}
          className="px-5 py-2 rounded-lg bg-amber-500/80 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
        >
          {initial ? 'Save Changes' : 'Finalize Prompt'}
        </button>
      </div>
    </div>
  );
}

// ── Variables fill-in modal ─────────────────────────────────────────────────
function VariablesModal({
  prompt,
  onClose,
  onCopy,
}: {
  prompt: Prompt;
  onClose: () => void;
  onCopy: (id: string) => void;
}) {
  const vars = PromptService.extractVariables(prompt.content);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(vars.map((v) => [v, ''])),
  );
  const [copied, setCopied] = useState(false);
  const preview = PromptService.applyVariables(prompt.content, values);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
    onCopy(prompt.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-4xl glass-panel rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-amber-400" />
            <span className="text-base font-semibold" style={T}>Fill Variables</span>
            <span className="text-sm opacity-40 truncate max-w-[240px]" style={TS}>— {prompt.title}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={TS}>
            <X size={15} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0 overflow-hidden min-h-[420px]">
          {/* Left: variable inputs */}
          <div className="w-[35%] shrink-0 border-r border-white/10 overflow-y-auto px-4 py-4 space-y-4">
            <p className="text-xs uppercase tracking-wide opacity-50 font-semibold" style={TS}>Variables</p>
            {vars.map((v) => (
              <div key={v}>
                <label className="text-sm font-mono text-amber-400 block mb-1.5">{'{{'}{v}{'}}'}</label>
                <input
                  value={values[v] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                  placeholder={`Enter ${v}…`}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-white/15 bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
                  style={T}
                />
              </div>
            ))}
          </div>

          {/* Right: prompt preview */}
          <div className="flex-1 flex flex-col px-4 py-4">
            <p className="text-xs uppercase tracking-wide opacity-50 font-semibold mb-2" style={TS}>Prompt Text</p>
            <textarea
              readOnly
              value={preview}
              className="flex-1 w-full px-4 py-3 text-sm rounded-lg border border-white/15 bg-white/5 resize-none focus:outline-none font-mono leading-relaxed"
              style={T}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-white/15 text-sm hover:bg-white/10 transition-colors"
            style={TS}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCopy()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Final'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini folder tree item (source-scoped, with inline CRUD) ─────────────────
function MiniFolderItem({
  folder,
  allFolders,
  allPrompts,
  source,
  activeFolderId,
  depth,
  readonly,
  onSelect,
  folderVisible,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveFolder,
}: {
  folder: PromptFolder;
  allFolders: PromptFolder[];
  allPrompts: Prompt[];
  source: 'local' | 'app';
  activeFolderId: string | undefined;
  depth: number;
  readonly?: boolean;
  onSelect: (id: string) => void;
  folderVisible: (f: PromptFolder) => boolean;
  onCreateFolder?: (name: string, parentId?: string, source?: 'local' | 'app') => Promise<PromptFolder>;
  onUpdateFolder?: (id: string, updates: Partial<Pick<PromptFolder, 'name' | 'color'>>) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onMoveFolder?: (id: string, newParentId: string | undefined) => Promise<void>;
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
    .filter((f) => f.parentId === folder.id && folderVisible(f))
    .sort((a, b) => a.position - b.position);
  const isActive = activeFolderId === folder.id;
  const promptCount = allPrompts.filter((p) => p.source === source && p.folderId === folder.id).length;
  const FolderIcon = expanded && children.length > 0 ? FolderOpen : Folder;
  const indentPx = depth * 10 + 8;

  // Valid move targets: same source, exclude self + descendants
  const getDescendantIds = (id: string): Set<string> => {
    const result = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      result.add(cur);
      allFolders.filter((f) => f.parentId === cur).forEach((f) => queue.push(f.id));
    }
    return result;
  };
  const moveTargets = allFolders.filter((f) => {
    const descendants = getDescendantIds(folder.id);
    return f.source === source && !descendants.has(f.id);
  });

  const handleRenameSubmit = async () => {
    const name = renameName.trim();
    if (name && onUpdateFolder) {
      await onUpdateFolder(folder.id, { name, color: renameColor || undefined });
    }
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await onDeleteFolder?.(folder.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleAddChild = async () => {
    const name = newChildName.trim();
    if (!name) return;
    await onCreateFolder?.(name, folder.id, source);
    setNewChildName('');
    setAddingChild(false);
    setExpanded(true);
  };

  const handleMove = async (newParentId: string | undefined) => {
    await onMoveFolder?.(folder.id, newParentId);
    setMoving(false);
  };

  return (
    <div>
      {/* Row */}
      <div
        className={`group flex items-center gap-1.5 py-1 rounded-lg cursor-pointer text-xs transition-colors ${
          isActive ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/10'
        }`}
        style={{ ...(isActive ? undefined : TS), paddingLeft: `${indentPx}px`, paddingRight: '6px' }}
        onClick={() => { onSelect(folder.id); if (children.length > 0) setExpanded((v) => !v); }}
      >
        {/* Chevron */}
        {children.length > 0 ? (
          <span className="shrink-0 opacity-50" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>
            {expanded ? <ChevronDownIcon size={9} /> : <ChevronRight size={9} />}
          </span>
        ) : (
          <span className="w-[9px] shrink-0" />
        )}

        {/* Folder icon */}
        <FolderIcon size={11} className="shrink-0" style={{ color: folder.color ?? 'currentColor' }} />

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
            className="flex-1 min-w-0 text-xs bg-transparent border-b border-amber-400 outline-none"
            style={T}
          />
        ) : (
          <span className="flex-1 truncate text-left">{folder.name}</span>
        )}

        {/* Prompt count */}
        {!renaming && promptCount > 0 && <span className="opacity-40 text-[9px] shrink-0">{promptCount}</span>}

        {/* Hover actions — only for writable local folders */}
        {!renaming && !readonly && (
          <span
            className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {onCreateFolder && (
              <button
                onClick={() => setAddingChild(true)}
                className="p-0.5 rounded hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
                style={TS}
                title="Add sub-folder"
              >
                <Plus size={9} />
              </button>
            )}
            {onUpdateFolder && (
              <button
                onClick={() => { setRenaming(true); setRenameName(folder.name); setRenameColor(folder.color ?? ''); }}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
                style={TS}
                title="Rename / color"
              >
                <Pencil size={9} />
              </button>
            )}
            {onMoveFolder && (
              <button
                onClick={() => setMoving((v) => !v)}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
                style={TS}
                title="Move folder"
              >
                <ArrowRightLeft size={9} />
              </button>
            )}
            {onDeleteFolder && (
              <button
                onClick={() => void handleDelete()}
                className={`p-0.5 rounded transition-colors ${
                  confirmDelete ? 'text-red-400 bg-red-500/20' : 'hover:text-red-400'
                }`}
                style={confirmDelete ? undefined : TS}
                title={confirmDelete ? 'Click again to confirm delete' : 'Delete folder'}
              >
                {confirmDelete ? <Check size={9} /> : <Trash2 size={9} />}
              </button>
            )}
          </span>
        )}
      </div>

      {/* Color picker (shown during rename) */}
      {renaming && (
        <div
          className="flex items-center gap-1 py-1 flex-wrap"
          style={{ paddingLeft: `${indentPx + 14}px`, paddingRight: '6px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {FOLDER_COLORS.map((c) => (
            <button
              key={c === '' ? 'none' : c}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setRenameColor(c); }}
              className={`w-3 h-3 rounded-full border-2 transition-all ${
                renameColor === c ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{
                backgroundColor: c === '' ? 'transparent' : c,
                outline: c === '' ? '1px solid rgba(255,255,255,0.3)' : undefined,
              }}
            />
          ))}
        </div>
      )}

      {/* Move target list */}
      {moving && !readonly && (
        <div
          className="py-1 space-y-0.5"
          style={{ paddingLeft: `${indentPx + 14}px`, paddingRight: '6px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] opacity-40 mb-1" style={TS}>Move to:</p>
          <button
            onClick={() => void handleMove(undefined)}
            className="w-full text-left text-xs px-2 py-0.5 rounded hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
            style={TS}
          >
            Root level
          </button>
          {moveTargets.map((t) => (
            <button
              key={t.id}
              onClick={() => void handleMove(t.id)}
              className="w-full text-left text-xs px-2 py-0.5 rounded hover:bg-amber-500/20 hover:text-amber-300 transition-colors truncate"
              style={TS}
            >
              <Folder size={9} className="inline mr-1" style={{ color: t.color ?? 'currentColor' }} />
              {t.name}
            </button>
          ))}
          <button
            onClick={() => setMoving(false)}
            className="w-full text-left text-xs px-2 py-0.5 rounded opacity-40 hover:opacity-70 transition-opacity"
            style={TS}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Inline add-child input */}
      {addingChild && !readonly && (
        <div
          className="flex items-center gap-1 py-1"
          style={{ paddingLeft: `${indentPx + 14}px`, paddingRight: '6px' }}
        >
          <Folder size={10} className="shrink-0 opacity-50" style={TS} />
          <input
            autoFocus
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void handleAddChild(); }
              if (e.key === 'Escape') { setAddingChild(false); setNewChildName(''); }
            }}
            placeholder="Sub-folder name…"
            className="flex-1 text-xs bg-transparent border-b border-amber-400 outline-none placeholder:opacity-30"
            style={T}
          />
          <button onClick={() => void handleAddChild()} className="p-0.5 text-amber-400 hover:text-amber-300">
            <Check size={9} />
          </button>
          <button onClick={() => { setAddingChild(false); setNewChildName(''); }} className="p-0.5 opacity-50" style={TS}>
            <X size={9} />
          </button>
        </div>
      )}

      {/* Children (recursive) */}
      {expanded && children.map((child) => (
        <MiniFolderItem
          key={child.id}
          folder={child}
          allFolders={allFolders}
          allPrompts={allPrompts}
          source={source}
          activeFolderId={activeFolderId}
          depth={depth + 1}
          readonly={readonly}
          onSelect={onSelect}
          folderVisible={folderVisible}
          onCreateFolder={onCreateFolder}
          onUpdateFolder={onUpdateFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveFolder={onMoveFolder}
        />
      ))}
    </div>
  );
}

// ── Mini source section (MY PROMPTS / APP PROMPTS) ──────────────────────────
function MiniSourceSection({
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
  folderVisible,
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
  onUpdateFolder?: (id: string, updates: Partial<Pick<PromptFolder, 'name' | 'color'>>) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onMoveFolder?: (id: string, newParentId: string | undefined) => Promise<void>;
  folderVisible: (f: PromptFolder) => boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  const isSourceActive = nav.kind === 'source' && nav.source === source && !nav.folderId;
  const activeFolderId = nav.kind === 'source' && nav.source === source ? nav.folderId : undefined;
  const totalCount = prompts.filter((p) => p.source === source).length;
  const rootFolders = folders
    .filter((f) => !f.parentId && folderVisible(f))
    .sort((a, b) => a.position - b.position);

  const handleAddRoot = async () => {
    const name = newRootName.trim();
    if (!name) return;
    await onCreateFolder(name, undefined, source);
    setNewRootName('');
    setAddingRoot(false);
    setExpanded(true);
  };

  return (
    <div className="mb-1">
      {/* Section header */}
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
          isSourceActive ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/10'
        }`}
        style={isSourceActive ? undefined : TS}
        onClick={() => onNavigate({ kind: 'source', source })}
      >
        <span
          className="shrink-0 opacity-50"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        >
          {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        </span>
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 truncate font-semibold text-sm">{label}</span>
        {totalCount > 0 && <span className="opacity-40 text-xs">{totalCount}</span>}
        {!readonly && (
          <button
            onClick={(e) => { e.stopPropagation(); setAddingRoot(true); setExpanded(true); }}
            className="hidden group-hover:flex shrink-0 p-0.5 rounded hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
            title={`New folder in ${label}`}
          >
            <Plus size={10} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-0.5">
          {addingRoot && (
            <div className="flex items-center gap-1 py-1 pl-8 pr-1">
              <Folder size={10} className="shrink-0 opacity-50" style={TS} />
              <input
                autoFocus
                value={newRootName}
                onChange={(e) => setNewRootName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleAddRoot(); }
                  if (e.key === 'Escape') { setAddingRoot(false); setNewRootName(''); }
                }}
                placeholder="Folder name…"
                className="flex-1 text-xs bg-transparent border-b border-amber-400 outline-none placeholder:opacity-30"
                style={T}
              />
              <button onClick={() => void handleAddRoot()} className="p-0.5 text-amber-400 hover:text-amber-300">
                <Check size={9} />
              </button>
              <button onClick={() => { setAddingRoot(false); setNewRootName(''); }} className="p-0.5 opacity-50">
                <X size={9} />
              </button>
            </div>
          )}
          {rootFolders.length === 0 && !addingRoot && (
            <p className="pl-8 py-0.5 text-[9px] opacity-25 italic" style={TS}>Click + to add a folder</p>
          )}
          {rootFolders.map((folder) => (
            <MiniFolderItem
              key={folder.id}
              folder={folder}
              allFolders={folders}
              allPrompts={prompts}
              source={source}
              activeFolderId={activeFolderId}
              depth={0}
              readonly={readonly}
              onSelect={(id) => onNavigate({ kind: 'source', source, folderId: id })}
              folderVisible={folderVisible}
              onCreateFolder={readonly ? undefined : onCreateFolder}
              onUpdateFolder={readonly ? undefined : onUpdateFolder}
              onDeleteFolder={readonly ? undefined : onDeleteFolder}
              onMoveFolder={readonly ? undefined : onMoveFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────
export default function PromptsPanel() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [tags, setTags] = useState<PromptTag[]>([]);
  const [folders, setFolders] = useState<PromptFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [nav, setNav] = useState<PromptsNavState>({ kind: 'section', key: 'all' });

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<PromptSortField>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null);
  const [variablesPrompt, setVariablesPrompt] = useState<Prompt | null>(null);

  const reloadAll = useCallback(async () => {
    const [p, c, t, f] = await Promise.all([
      PromptStorage.getAll(),
      PromptStorage.getCategories(),
      PromptStorage.getTags(),
      PromptStorage.getFolders(),
    ]);
    setPrompts(p); setCategories(c); setTags(t); setFolders(f);
  }, []);

  useEffect(() => {
    async function init() {
      // Seed folder structure and demo prompts on first load (idempotent — skips existing IDs)
      await Promise.all([
        PromptStorage.seedAppFolders(),
        PromptStorage.seedDemoData(),
      ]);
      await reloadAll();
      setIsLoading(false);
    }
    void init();
  }, [reloadAll]);

  const handleSave = useCallback(async (prompt: Prompt) => {
    await PromptStorage.save(prompt);
    setPrompts((prev) => {
      const idx = prev.findIndex((p) => p.id === prompt.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = prompt; return next; }
      return [...prev, prompt];
    });
    setFormOpen(false);
    setEditPrompt(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await PromptStorage.delete(id);
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const p = prompts.find((x) => x.id === id);
    if (!p) return;
    await PromptStorage.update(id, { isFavorite: !p.isFavorite });
    setPrompts((prev) => prev.map((x) => x.id === id ? { ...x, isFavorite: !x.isFavorite } : x));
  }, [prompts]);

  const handleTogglePin = useCallback(async (id: string) => {
    const p = prompts.find((x) => x.id === id);
    if (!p) return;
    await PromptStorage.update(id, { isPinned: !p.isPinned });
    setPrompts((prev) => prev.map((x) => x.id === id ? { ...x, isPinned: !x.isPinned } : x));
  }, [prompts]);

  const handleCopy = useCallback(async (id: string) => {
    await PromptStorage.trackUsage(id);
    setPrompts((prev) => prev.map((x) =>
      x.id === id ? { ...x, usageCount: x.usageCount + 1, lastUsedAt: new Date().toISOString() } : x,
    ));
  }, []);

  const handleUse = useCallback((p: Prompt) => {
    const vars = PromptService.extractVariables(p.content);
    if (vars.length > 0) { setVariablesPrompt(p); }
    else { void navigator.clipboard.writeText(p.content); void handleCopy(p.id); }
  }, [handleCopy]);

  const handleCreateFolder = useCallback(async (name: string, parentId?: string, source: 'local' | 'app' = 'local'): Promise<PromptFolder> => {
    const siblings = folders.filter(
      (f) => f.source === source && (f.parentId ?? null) === (parentId ?? null),
    );
    const folder: PromptFolder = {
      id: generateId(),
      name,
      source,
      parentId,
      position: siblings.length,
      createdAt: new Date().toISOString(),
    };
    await PromptStorage.saveFolder(folder);
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, [folders]);

  const handleUpdateFolder = useCallback(async (id: string, updates: Partial<Pick<PromptFolder, 'name' | 'color'>>) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const updated = { ...folder, ...updates };
    await PromptStorage.saveFolder(updated);
    setFolders((prev) => prev.map((f) => f.id === id ? updated : f));
  }, [folders]);

  const handleDeleteFolder = useCallback(async (id: string) => {
    await PromptStorage.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setPrompts((prev) => prev.map((p) => p.folderId === id ? { ...p, folderId: undefined } : p));
    setNav((prevNav) =>
      prevNav.kind === 'source' && prevNav.folderId === id
        ? { kind: 'source', source: prevNav.source }
        : prevNav,
    );
  }, [folders]);

  const handleMoveFolder = useCallback(async (id: string, newParentId: string | undefined) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const siblings = folders.filter(
      (f) => f.source === folder.source && (f.parentId ?? undefined) === newParentId && f.id !== id,
    );
    const updated: PromptFolder = { ...folder, parentId: newParentId, position: siblings.length };
    await PromptStorage.saveFolder(updated);
    setFolders((prev) => prev.map((f) => f.id === id ? updated : f));
  }, [folders]);

  const handleCreateTag = useCallback(async (name: string): Promise<PromptTag> => {
    const tag: PromptTag = {
      id: generateId(),
      name,
      color: `hsl(${Math.floor(Math.random() * 360)}, 65%, 55%)`,
    };
    await PromptStorage.saveTag(tag);
    setTags((prev) => [...prev, tag]);
    return tag;
  }, []);

  const handleNavigate = useCallback((next: PromptsNavState) => {
    setNav(next);
    setSearch('');
  }, []);

  // Derive visible prompts from nav + search
  const sectionPrompts = useMemo(() => {
    if (nav.kind === 'section') {
      return PromptService.filterBySection(prompts, nav.key);
    }
    const sourcePrompts = prompts.filter((p) => p.source === nav.source);
    if (!nav.folderId) return sourcePrompts;
    return PromptService.getPromptsInFolder(sourcePrompts, nav.folderId, folders);
  }, [prompts, folders, nav]);

  const filtered = useMemo(
    () => search
      ? PromptService.filterPrompts(sectionPrompts, { search })
      : sectionPrompts,
    [sectionPrompts, search],
  );

  const sorted = useMemo(
    () => PromptService.sortPrompts(filtered, sortBy, sortDir),
    [filtered, sortBy, sortDir],
  );

  const sectionLabel = useMemo(() => {
    if (nav.kind === 'section') {
      return TOP_SECTIONS.find((s) => s.key === nav.key)?.label ?? 'Prompts';
    }
    if (!nav.folderId) return nav.source === 'local' ? 'My Prompts' : 'App Prompts';
    return folders.find((f) => f.id === nav.folderId)?.name ?? 'Folder';
  }, [nav, folders]);

  // App folders that transitively contain at least one local prompt (shown in My Prompts nav)
  const activeAppFolderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of prompts) {
      if (p.source === 'local' && p.folderId) {
        const folder = folders.find((f) => f.id === p.folderId);
        if (folder?.source === 'app') {
          let fid: string | undefined = p.folderId;
          while (fid) {
            ids.add(fid);
            const parent = folders.find((f) => f.id === fid);
            fid = parent?.parentId;
          }
        }
      }
    }
    return ids;
  }, [prompts, folders]);

  // Child folders of the current nav location — filtered by source scope
  const childFolders = useMemo(() => {
    if (nav.kind !== 'source') return [];
    const isVisible =
      nav.source === 'app'
        ? (f: PromptFolder) => f.source === 'app'
        : (f: PromptFolder) => f.source === 'local' || activeAppFolderIds.has(f.id);
    return folders
      .filter((f) => (nav.folderId ? f.parentId === nav.folderId : !f.parentId) && isVisible(f))
      .sort((a, b) => a.position - b.position);
  }, [nav, folders, activeAppFolderIds]);

  // Breadcrumb path from source root to current folder
  const breadcrumb = useMemo(() => {
    if (nav.kind !== 'source' || !nav.folderId) return [];
    const path: Array<{ id: string; name: string }> = [];
    let current = folders.find((f) => f.id === nav.folderId);
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
    }
    return path;
  }, [nav, folders]);

  // Prompt count per folder (for the current source, only direct prompts)
  const folderPromptCount = useMemo(() => {
    if (nav.kind !== 'source') return {} as Record<string, number>;
    const sourcePrompts = prompts.filter((p) => p.source === nav.source);
    const counts: Record<string, number> = {};
    for (const f of folders) {
      counts[f.id] = sourcePrompts.filter((p) => p.folderId === f.id).length;
    }
    return counts;
  }, [nav, prompts, folders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-400" />
          <span className="font-bold text-base" style={T}>Prompt Manager</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 ml-1" style={TS}>{prompts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {!(nav.kind === 'source' && nav.source === 'app') && (
            <button
              onClick={() => { setEditPrompt(null); setFormOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/80 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Two-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: section nav (compact) */}
        <nav className="w-52 shrink-0 border-r border-white/10 flex flex-col overflow-y-auto py-2 px-1.5 select-none">
          {/* Top 4 utility sections */}
          <div className="space-y-0.5 mb-2">
            {TOP_SECTIONS.map(({ key, label, icon }) => {
              const count = PromptService.filterBySection(prompts, key).length;
              const isActive = nav.kind === 'section' && nav.key === key;
              return (
                <button
                  key={key}
                  onClick={() => handleNavigate({ kind: 'section', key })}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/10'
                  }`}
                  style={isActive ? undefined : TS}
                >
                  <span className="shrink-0">{icon}</span>
                  <span className="flex-1 text-left truncate">{label}</span>
                  {count > 0 && (
                    <span className={`text-[9px] shrink-0 ${isActive ? 'text-amber-300' : 'opacity-40'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mx-1 mb-2 border-t border-white/10" />

          {/* MY PROMPTS section — shows local folders + af-* folders with local prompts */}
          <MiniSourceSection
            source="local"
            label="My Prompts"
            icon={<Monitor size={13} />}
            prompts={prompts}
            folders={folders}
            nav={nav}
            onNavigate={handleNavigate}
            onCreateFolder={handleCreateFolder}
            onUpdateFolder={handleUpdateFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveFolder={handleMoveFolder}
            folderVisible={(f) => f.source === 'local' || activeAppFolderIds.has(f.id)}
          />

          {/* Divider */}
          <div className="mx-1 my-2 border-t border-white/10" />

          {/* APP PROMPTS section — read-only, shows only app folders */}
          <MiniSourceSection
            source="app"
            label="App Prompts"
            icon={<Globe size={13} />}
            prompts={prompts}
            folders={folders}
            nav={nav}
            readonly
            onNavigate={handleNavigate}
            onCreateFolder={handleCreateFolder}
            folderVisible={(f) => f.source === 'app'}
          />
        </nav>

        {/* Right: content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Section title + search */}
          <div className="px-3 pt-3 pb-2.5 shrink-0 space-y-2.5">
            {/* Breadcrumb — shown when navigated into a folder */}
            {nav.kind === 'source' && breadcrumb.length > 0 && (
              <nav className="flex items-center gap-1 flex-wrap text-xs" style={TS}>
                <button
                  onClick={() => handleNavigate({ kind: 'source', source: nav.source })}
                  className="hover:text-amber-300 transition-colors"
                >
                  {nav.source === 'local' ? 'My Prompts' : 'App Prompts'}
                </button>
                {breadcrumb.map((crumb, i) => (
                  <span key={crumb.id} className="flex items-center gap-1">
                    <ChevronRight size={10} className="opacity-40" />
                    {i === breadcrumb.length - 1 ? (
                      <span className="font-medium" style={T}>{crumb.name}</span>
                    ) : (
                      <button
                        onClick={() => handleNavigate({ kind: 'source', source: nav.source, folderId: crumb.id })}
                        className="hover:text-amber-300 transition-colors"
                      >
                        {crumb.name}
                      </button>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={T}>
                {sectionLabel}
                <span className="ml-2 text-xs font-normal opacity-50">{sorted.length}</span>
              </span>
              <div className="flex items-center gap-1.5">
                {(['updatedAt', 'title', 'usageCount'] as PromptSortField[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      if (sortBy === f) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                      else { setSortBy(f); setSortDir('desc'); }
                    }}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      sortBy === f ? 'border-amber-400/60 text-amber-400' : 'border-white/10 hover:border-white/25'
                    }`}
                    style={sortBy === f ? undefined : TS}
                  >
                    {f === 'updatedAt' ? 'Date' : f === 'usageCount' ? 'Used' : 'A–Z'}
                    {sortBy === f && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={TS} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-white/15 bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
                style={T}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={TS}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Prompt list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {/* Folder cards — shown when in a source location with child folders and no active search */}
            {nav.kind === 'source' && childFolders.length > 0 && !search && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {childFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleNavigate({ kind: 'source', source: nav.source, folderId: folder.id })}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/10 glass hover:border-amber-400/40 hover:bg-amber-500/5 transition-all text-center group"
                  >
                    <Folder
                      size={22}
                      className="group-hover:text-amber-400 transition-colors"
                      style={{ color: folder.color ?? undefined }}
                    />
                    <span className="text-xs font-medium truncate w-full" style={T}>{folder.name}</span>
                    {(folderPromptCount[folder.id] ?? 0) > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10" style={TS}>
                        {folderPromptCount[folder.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {sorted.length === 0 && !formOpen ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Sparkles size={32} className="text-amber-400 opacity-30" />
                <div>
                  <p className="text-sm font-medium" style={T}>
                    {search ? 'No matching prompts' : 'No prompts here yet'}
                  </p>
                  <p className="text-xs mt-1 opacity-50" style={TS}>
                    {search ? 'Try a different search term' : 'Create one or load sample data to get started'}
                  </p>
                </div>
                {!search && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditPrompt(null); setFormOpen(true); }}
                      className="px-4 py-2 rounded-lg bg-amber-500/80 text-white text-sm hover:bg-amber-500 transition-colors"
                    >
                      + Add prompt
                    </button>
                  </div>
                )}
              </div>
            ) : (
              sorted.map((p) => (
                <PanelPromptCard
                  key={p.id}
                  prompt={p}
                  tags={tags}
                  folders={folders}
                  onEdit={(x) => { setEditPrompt(x); setFormOpen(true); }}
                  onDelete={(id) => void handleDelete(id)}
                  onToggleFavorite={(id) => void handleToggleFavorite(id)}
                  onTogglePin={(id) => void handleTogglePin(id)}
                  onCopy={(id) => void handleCopy(id)}
                  onUse={handleUse}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Variables modal */}
      {variablesPrompt && (
        <VariablesModal
          prompt={variablesPrompt}
          onClose={() => setVariablesPrompt(null)}
          onCopy={(id) => { void handleCopy(id); setVariablesPrompt(null); }}
        />
      )}

      {/* Form modal overlay */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) { setFormOpen(false); setEditPrompt(null); } }}
        >
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            <InlinePromptForm
              initial={editPrompt}
              categories={categories}
              tags={tags}
              folders={folders}
              defaultFolderId={nav.kind === 'source' ? nav.folderId : undefined}
              defaultSource={nav.kind === 'source' ? nav.source : undefined}
              onSave={(p) => void handleSave(p)}
              onCancel={() => { setFormOpen(false); setEditPrompt(null); }}
              onCreateFolder={(name) => handleCreateFolder(name)}
              onCreateTag={handleCreateTag}
            />
          </div>
        </div>
      )}
    </div>
  );
}
