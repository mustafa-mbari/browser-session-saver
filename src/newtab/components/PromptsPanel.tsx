import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Copy, Check, Pencil, Trash2,
  Pin, PinOff, Star, ChevronDown, ChevronUp, Zap, X, Sparkles,
  Home, LayoutList, Zap as ZapIcon, Star as StarIcon, Monitor, Globe, Folder, FolderOpen,
  ChevronRight,
} from 'lucide-react';
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

// ── Top utility section definitions ────────────────────────────────────────
const TOP_SECTIONS: Array<{ key: PromptSectionKey; label: string; icon: React.ReactNode }> = [
  { key: 'start',        label: 'Start',     icon: <Home size={12} /> },
  { key: 'quick-access', label: 'Pinned',    icon: <ZapIcon size={12} /> },
  { key: 'all',          label: 'All',       icon: <LayoutList size={12} /> },
  { key: 'favorites',    label: 'Favorites', icon: <StarIcon size={12} /> },
];

// ── Prompt row card ─────────────────────────────────────────────────────────
function PanelPromptCard({
  prompt,
  tags,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onCopy,
  onUse,
}: {
  prompt: Prompt;
  tags: PromptTag[];
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
    <div className={`rounded-xl border glass mb-1.5 ${prompt.isPinned ? 'border-amber-400/40' : 'border-white/10'}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {prompt.isPinned && <Pin size={10} className="text-amber-400 shrink-0" />}
            <span className="text-sm font-medium truncate" style={T}>{prompt.title}</span>
            {prompt.isFavorite && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
            {/* Source badge */}
            <span className={`ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              prompt.source === 'app'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-white/10 text-white/40'
            }`}>
              {prompt.source === 'app' ? 'App' : 'Local'}
            </span>
          </div>
          {!expanded && (
            <p className="text-xs truncate" style={TS}>{prompt.content}</p>
          )}
          {promptTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {promptTags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="shrink-0 mt-0.5" style={TS}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/10">
          <div className="mt-2 rounded-lg bg-white/5 p-2.5">
            <p className="text-xs whitespace-pre-wrap break-words leading-relaxed" style={T}>{prompt.content}</p>
          </div>
          {hasVars && (
            <p className="text-[10px] text-amber-400">Contains variables</p>
          )}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            <button
              onClick={(e) => void handleCopy(e)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/80 text-white hover:bg-amber-500 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {hasVars && (
              <button
                onClick={(e) => { e.stopPropagation(); onUse(prompt); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 transition-colors"
                style={T}
              >
                <Zap size={12} /> Use
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(prompt); }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 transition-colors"
              style={TS}
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(prompt.id); }}
              className={`p-1.5 rounded-lg transition-colors ${prompt.isPinned ? 'text-amber-400 bg-amber-500/20' : 'bg-white/5 hover:bg-white/15'}`}
              style={prompt.isPinned ? undefined : TS}
              title={prompt.isPinned ? 'Unpin' : 'Pin'}
            >
              {prompt.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(prompt.id); }}
              className={`p-1.5 rounded-lg transition-colors ${prompt.isFavorite ? 'text-amber-400 bg-amber-500/20' : 'bg-white/5 hover:bg-white/15'}`}
              style={prompt.isFavorite ? undefined : TS}
              title={prompt.isFavorite ? 'Remove favorite' : 'Favorite'}
            >
              <Star size={12} className={prompt.isFavorite ? 'fill-amber-400' : ''} />
            </button>
            <button
              onClick={handleDelete}
              className={`ml-auto p-1.5 rounded-lg transition-colors ${confirmDelete ? 'text-red-400 bg-red-500/20' : 'bg-white/5 hover:bg-red-500/20 hover:text-red-400'}`}
              style={confirmDelete ? undefined : TS}
              title={confirmDelete ? 'Click to confirm' : 'Delete'}
            >
              <Trash2 size={12} />
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
  defaultFolderId,
  defaultSource,
  onSave,
  onCancel,
}: {
  initial: Prompt | null;
  categories: PromptCategory[];
  tags: PromptTag[];
  defaultFolderId?: string;
  defaultSource?: 'local' | 'app';
  onSave: (p: Prompt) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [source, setSource] = useState<'local' | 'app'>(initial?.source ?? defaultSource ?? 'local');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initial?.tags ?? []);
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  const detectedVars = PromptService.extractVariables(content);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
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
      description: description.trim() || undefined,
      categoryId: categoryId || undefined,
      folderId: initial?.folderId ?? defaultFolderId,
      source,
      tags: selectedTagIds,
      isFavorite: initial?.isFavorite ?? false,
      isPinned: initial?.isPinned ?? false,
      usageCount: initial?.usageCount ?? 0,
      lastUsedAt: initial?.lastUsedAt,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors placeholder:opacity-40';

  return (
    <div className="glass-panel rounded-xl p-3 space-y-3 mb-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={T}>{initial ? 'Edit Prompt' : 'New Prompt'}</span>
        <button onClick={onCancel} className="p-1 rounded hover:bg-white/10" style={TS} aria-label="Cancel">
          <X size={14} />
        </button>
      </div>

      <div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title *"
          className={inputCls}
          style={T}
        />
        {errors.title && <p className="text-xs text-red-400 mt-0.5">{errors.title}</p>}
      </div>

      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'Prompt content *\nUse {{variable}} for dynamic parts'}
          rows={4}
          className={`${inputCls} resize-none`}
          style={T}
        />
        {errors.content && <p className="text-xs text-red-400 mt-0.5">{errors.content}</p>}
        {detectedVars.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {detectedVars.map((v) => (
              <span key={v} className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                {'{{'}{v}{'}}'}
              </span>
            ))}
          </div>
        )}
      </div>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className={inputCls}
        style={T}
      />

      {/* Source toggle */}
      <div className="flex rounded-lg border border-white/15 overflow-hidden">
        <button
          type="button"
          onClick={() => setSource('local')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs transition-colors ${
            source === 'local' ? 'bg-amber-500/80 text-white' : 'bg-white/5 hover:bg-white/10'
          }`}
          style={source === 'local' ? undefined : TS}
        >
          <Monitor size={11} /> Local
        </button>
        <button
          type="button"
          onClick={() => setSource('app')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border-l border-white/15 transition-colors ${
            source === 'app' ? 'bg-amber-500/80 text-white' : 'bg-white/5 hover:bg-white/10'
          }`}
          style={source === 'app' ? undefined : TS}
        >
          <Globe size={11} /> App
        </button>
      </div>

      {categories.length > 0 && (
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${inputCls} bg-black/20`}
          style={T}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors"
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

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg border border-white/15 text-xs hover:bg-white/10 transition-colors"
          style={TS}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 py-1.5 rounded-lg bg-amber-500/80 text-white text-xs font-medium hover:bg-amber-500 transition-colors"
        >
          {initial ? 'Save' : 'Create'}
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl glass-panel shadow-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm" style={T}>Fill Variables</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={TS}>
            <X size={14} />
          </button>
        </div>

        {vars.map((v) => (
          <div key={v}>
            <label className="text-xs font-mono text-amber-400 block mb-0.5">{'{{'}{v}{'}}'}</label>
            <input
              value={values[v] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
              placeholder={`Enter ${v}...`}
              className="w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
              style={T}
            />
          </div>
        ))}

        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-xs whitespace-pre-wrap break-words leading-relaxed" style={T}>{preview}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-1.5 rounded-lg border border-white/15 text-xs hover:bg-white/10 transition-colors" style={TS}>
            Cancel
          </button>
          <button
            onClick={() => void handleCopy()}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-amber-500/80 text-white text-xs font-medium hover:bg-amber-500 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy Final'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini folder tree item (source-scoped) ───────────────────────────────────
function MiniFolderItem({
  folder,
  allFolders,
  allPrompts,
  source,
  activeFolderId,
  depth,
  onSelect,
}: {
  folder: PromptFolder;
  allFolders: PromptFolder[];
  allPrompts: Prompt[];
  source: 'local' | 'app';
  activeFolderId: string | undefined;
  depth: number;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allFolders
    .filter((f) => f.parentId === folder.id)
    .sort((a, b) => a.position - b.position);
  const isActive = activeFolderId === folder.id;
  const promptCount = allPrompts.filter((p) => p.source === source && p.folderId === folder.id).length;
  const FolderIcon = expanded && children.length > 0 ? FolderOpen : Folder;
  const indentPx = depth * 10 + 8;

  return (
    <div>
      <button
        onClick={() => { onSelect(folder.id); if (children.length > 0) setExpanded((v) => !v); }}
        className={`w-full flex items-center gap-1.5 py-1 rounded-lg text-xs transition-colors ${
          isActive ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/10'
        }`}
        style={{ ...(isActive ? undefined : TS), paddingLeft: `${indentPx}px`, paddingRight: '6px' }}
      >
        {children.length > 0 ? (
          <span className="shrink-0 opacity-50" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>
            {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
          </span>
        ) : (
          <span className="w-[9px] shrink-0" />
        )}
        <FolderIcon size={11} className="shrink-0" style={{ color: folder.color ?? 'currentColor' }} />
        <span className="flex-1 truncate text-left">{folder.name}</span>
        {promptCount > 0 && <span className="opacity-40 text-[9px]">{promptCount}</span>}
      </button>
      {expanded && children.map((child) => (
        <MiniFolderItem
          key={child.id}
          folder={child}
          allFolders={allFolders}
          allPrompts={allPrompts}
          source={source}
          activeFolderId={activeFolderId}
          depth={depth + 1}
          onSelect={onSelect}
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
  onNavigate,
  onCreateFolder,
}: {
  source: 'local' | 'app';
  label: string;
  icon: React.ReactNode;
  prompts: Prompt[];
  folders: PromptFolder[];
  nav: PromptsNavState;
  onNavigate: (nav: PromptsNavState) => void;
  onCreateFolder: (name: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  const isSourceActive = nav.kind === 'source' && nav.source === source && !nav.folderId;
  const activeFolderId = nav.kind === 'source' && nav.source === source ? nav.folderId : undefined;
  const totalCount = prompts.filter((p) => p.source === source).length;
  const rootFolders = folders.filter((f) => !f.parentId).sort((a, b) => a.position - b.position);

  const handleAddRoot = async () => {
    const name = newRootName.trim();
    if (!name) return;
    await onCreateFolder(name);
    setNewRootName('');
    setAddingRoot(false);
    setExpanded(true);
  };

  return (
    <div className="mb-1">
      {/* Section header */}
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
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
        <span className="flex-1 truncate font-semibold uppercase tracking-wide text-[9px]">{label}</span>
        {totalCount > 0 && <span className="opacity-40 text-[9px]">{totalCount}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); setAddingRoot(true); setExpanded(true); }}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-amber-500/20 hover:text-amber-300 transition-all"
          title={`New folder in ${label}`}
        >
          <Plus size={10} />
        </button>
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
              onSelect={(id) => onNavigate({ kind: 'source', source, folderId: id })}
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

  useEffect(() => {
    void Promise.all([
      PromptStorage.getAll(),
      PromptStorage.getCategories(),
      PromptStorage.getTags(),
      PromptStorage.getFolders(),
    ]).then(([p, c, t, f]) => {
      setPrompts(p);
      setCategories(c);
      setTags(t);
      setFolders(f);
      setIsLoading(false);
    });
  }, []);

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

  const handleCreateFolder = useCallback(async (name: string, parentId?: string) => {
    const siblings = folders.filter((f) => (f.parentId ?? null) === (parentId ?? null));
    const folder: PromptFolder = {
      id: generateId(),
      name,
      parentId,
      position: siblings.length,
      createdAt: new Date().toISOString(),
    };
    await PromptStorage.saveFolder(folder);
    setFolders((prev) => [...prev, folder]);
  }, [folders]);

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" />
          <span className="font-semibold text-sm" style={T}>Prompt Manager</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 ml-1" style={TS}>{prompts.length}</span>
        </div>
        <button
          onClick={() => { setEditPrompt(null); setFormOpen(true); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/80 text-white text-xs font-medium hover:bg-amber-500 transition-colors"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Two-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: section nav (compact) */}
        <nav className="w-32 shrink-0 border-r border-white/10 flex flex-col overflow-y-auto py-2 px-1 select-none">
          {/* Top 4 utility sections */}
          <div className="space-y-0.5 mb-2">
            {TOP_SECTIONS.map(({ key, label, icon }) => {
              const count = PromptService.filterBySection(prompts, key).length;
              const isActive = nav.kind === 'section' && nav.key === key;
              return (
                <button
                  key={key}
                  onClick={() => handleNavigate({ kind: 'section', key })}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
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

          {/* MY PROMPTS section */}
          <MiniSourceSection
            source="local"
            label="My Prompts"
            icon={<Monitor size={11} />}
            prompts={prompts}
            folders={folders}
            nav={nav}
            onNavigate={handleNavigate}
            onCreateFolder={(name) => handleCreateFolder(name)}
          />

          {/* Divider */}
          <div className="mx-1 my-2 border-t border-white/10" />

          {/* APP PROMPTS section */}
          <MiniSourceSection
            source="app"
            label="App Prompts"
            icon={<Globe size={11} />}
            prompts={prompts}
            folders={folders}
            nav={nav}
            onNavigate={handleNavigate}
            onCreateFolder={(name) => handleCreateFolder(name)}
          />
        </nav>

        {/* Right: content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Section title + search */}
          <div className="px-3 pt-2.5 pb-2 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={T}>{sectionLabel}</span>
              <div className="flex items-center gap-1">
                {(['updatedAt', 'title', 'usageCount'] as PromptSortField[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      if (sortBy === f) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                      else { setSortBy(f); setSortDir('desc'); }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                      sortBy === f ? 'border-amber-400/60 text-amber-400' : 'border-white/10 hover:border-white/25'
                    }`}
                    style={sortBy === f ? undefined : TS}
                  >
                    {f === 'updatedAt' ? 'Date' : f === 'usageCount' ? 'Used' : 'A–Z'}
                    {sortBy === f && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={TS} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-white/15 bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
                style={T}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={TS}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Prompt list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {/* Inline form */}
            {formOpen && (
              <InlinePromptForm
                initial={editPrompt}
                categories={categories}
                tags={tags}
                defaultFolderId={nav.kind === 'source' ? nav.folderId : undefined}
                defaultSource={nav.kind === 'source' ? nav.source : undefined}
                onSave={(p) => void handleSave(p)}
                onCancel={() => { setFormOpen(false); setEditPrompt(null); }}
              />
            )}

            {sorted.length === 0 && !formOpen ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles size={24} className="text-amber-400 opacity-40 mb-2" />
                <p className="text-xs" style={TS}>
                  {search ? 'No matching prompts' : 'No prompts here'}
                </p>
                {!search && (
                  <button
                    onClick={() => { setEditPrompt(null); setFormOpen(true); }}
                    className="mt-2 px-3 py-1 rounded-lg bg-amber-500/80 text-white text-xs hover:bg-amber-500 transition-colors"
                  >
                    Add prompt
                  </button>
                )}
              </div>
            ) : (
              sorted.map((p) => (
                <PanelPromptCard
                  key={p.id}
                  prompt={p}
                  tags={tags}
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
    </div>
  );
}
