import { useState, useEffect, useRef } from 'react';
import { X, Tag, Folder, Plus, Sparkles, Cpu, Check, ChevronDown } from 'lucide-react';
import type { Prompt, PromptCategory, PromptFolder, PromptTag } from '@core/types/prompt.types';
import { PromptService } from '@core/services/prompt.service';
import { generateId } from '@core/utils/uuid';

const DEFAULT_MODELS = ['GPT-4o', 'Claude 3.5', 'Gemini 1.5', 'Llama 3'];

// ── Model multi-select dropdown ─────────────────────────────────────────────

function ModelSelectDropdown({
  models,
  selected,
  onToggle,
  newName,
  setNewName,
  onAdd,
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

  const label = selected.length === 0
    ? 'No models selected'
    : selected.join(', ');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
      >
        <span className="truncate text-sm text-left">
          {selected.length > 0
            ? <span className="text-[var(--color-text)]">{label}</span>
            : <span className="text-[var(--color-text-secondary)]">No models selected</span>}
        </span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl overflow-hidden">
          {models.map((model) => (
            <button
              key={model}
              type="button"
              onClick={() => onToggle(model)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--color-bg-hover)] transition-colors text-left"
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                selected.includes(model)
                  ? 'bg-amber-500 border-amber-500'
                  : 'border-[var(--color-border)]'
              }`}>
                {selected.includes(model) && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-[var(--color-text)]">{model}</span>
            </button>
          ))}
          <div className="border-t border-[var(--color-border)] mx-0" />
          <div className="flex gap-1.5 p-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
              placeholder="Add custom model…"
              className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button
              onClick={onAdd}
              disabled={!newName.trim()}
              className="px-2.5 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category picker dropdown ─────────────────────────────────────────────────

function CategoryPickerDropdown({
  categories,
  value,
  onChange,
  onCreateCategory,
}: {
  categories: PromptCategory[];
  value: string;
  onChange: (id: string) => void;
  onCreateCategory?: (name: string) => Promise<PromptCategory>;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
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

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !onCreateCategory) return;
    const cat = await onCreateCategory(name);
    onChange(cat.id);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
      >
        <span className="truncate text-sm">
          {selected
            ? <span className="text-[var(--color-text)]">{selected.icon} {selected.name}</span>
            : <span className="text-[var(--color-text-secondary)]">No category</span>}
        </span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--color-bg-hover)] transition-colors text-left"
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${value === '' ? 'bg-amber-500 border-amber-500' : 'border-[var(--color-border)]'}`} />
              <span className="text-[var(--color-text-secondary)] italic text-xs">No category</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { onChange(cat.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--color-bg-hover)] transition-colors text-left"
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${value === cat.id ? 'bg-amber-500 border-amber-500' : 'border-[var(--color-border)]'}`} />
                <span className="text-[var(--color-text)] text-xs">{cat.icon} {cat.name}</span>
              </button>
            ))}
          </div>
          {onCreateCategory && (
            <>
              <div className="border-t border-[var(--color-border)]" />
              {creating ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void handleCreate(); }
                      if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                    }}
                    placeholder="Category name…"
                    className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-[var(--color-text-secondary)]"
                  />
                  <button onClick={() => void handleCreate()} disabled={!newName.trim()} className="p-1 text-amber-500 disabled:opacity-30">
                    <Check size={10} />
                  </button>
                  <button onClick={() => { setCreating(false); setNewName(''); }} className="p-1 text-[var(--color-text-secondary)] opacity-50">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-amber-500 transition-colors"
                >
                  <Plus size={11} /> New category
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Folder helpers ───────────────────────────────────────────────────────────

function flattenFolderTree(
  folders: PromptFolder[],
  parentId?: string,
  depth = 0,
): Array<{ folder: PromptFolder; depth: number }> {
  const children = folders
    .filter((f) => (f.parentId ?? undefined) === parentId)
    .sort((a, b) => a.position - b.position);
  return children.flatMap((f) => [{ folder: f, depth }, ...flattenFolderTree(folders, f.id, depth + 1)]);
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
  const flatFolders = flattenFolderTree(folders);

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
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Folder size={12} className="shrink-0 opacity-50" style={selectedFolder?.color ? { color: selectedFolder.color } : {}} />
          <span className="truncate text-sm">
            {selectedFolder
              ? selectedFolder.name
              : <span className="text-[var(--color-text-secondary)]">No folder</span>}
          </span>
        </div>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {/* No folder */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-[var(--color-bg-hover)] transition-colors text-left"
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
                value === '' ? 'bg-amber-500 border-amber-500' : 'border-[var(--color-border)]'
              }`} />
              <span className="text-[var(--color-text-secondary)] italic text-xs">No folder</span>
            </button>

            {flatFolders.map(({ folder, depth }) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => { onChange(folder.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 py-1.5 text-sm hover:bg-[var(--color-bg-hover)] transition-colors text-left pr-3"
                style={{ paddingLeft: `${depth * 14 + 12}px` }}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
                  value === folder.id ? 'bg-amber-500 border-amber-500' : 'border-[var(--color-border)]'
                }`} />
                <Folder size={12} className="shrink-0" style={{ color: folder.color ?? 'currentColor' }} />
                <span className="text-[var(--color-text)] truncate text-xs">{folder.name}</span>
              </button>
            ))}
          </div>

          {onCreateFolder && (
            <>
              <div className="border-t border-[var(--color-border)]" />
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
                    className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-[var(--color-text-secondary)]"
                  />
                  <button onClick={() => void handleCreate()} disabled={!newFolderName.trim()} className="p-1 text-amber-500 disabled:opacity-30">
                    <Check size={10} />
                  </button>
                  <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="p-1 text-[var(--color-text-secondary)] opacity-50">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingFolder(true)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-amber-500 transition-colors"
                >
                  <Plus size={11} /> New folder
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Form ────────────────────────────────────────────────────────────────────

interface PromptFormProps {
  initial: Prompt | null;
  categories: PromptCategory[];
  tags: PromptTag[];
  folders: PromptFolder[];
  defaultFolderId?: string;
  defaultSource?: 'local' | 'app';
  onSave: (prompt: Prompt) => void;
  onClose: () => void;
  onCreateTag?: (name: string) => Promise<PromptTag>;
  onCreateCategory?: (name: string) => Promise<PromptCategory>;
  onCreateFolder?: (name: string) => Promise<PromptFolder>;
}

export default function PromptForm({
  initial,
  categories,
  tags,
  folders,
  defaultFolderId,
  onSave,
  onClose,
  onCreateTag,
  onCreateCategory,
  onCreateFolder,
}: PromptFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [folderId, setFolderId] = useState(initial?.folderId ?? defaultFolderId ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initial?.tags ?? []);
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [newTagName, setNewTagName] = useState('');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

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

  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name || !onCreateTag) return;
    const tag = await onCreateTag(name);
    setSelectedTagIds((prev) => [...prev, tag.id]);
    setNewTagName('');
  };

  const validate = (): boolean => {
    const errs: { title?: string; content?: string } = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!content.trim()) errs.content = 'Content is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const prompt: Prompt = {
      id: initial?.id ?? generateId(),
      title: title.trim(),
      content: content.trim(),
      categoryId: categoryId || undefined,
      folderId: folderId || undefined,
      source: initial?.source ?? 'local',
      tags: selectedTagIds,
      isFavorite,
      isPinned: initial?.isPinned ?? false,
      usageCount: initial?.usageCount ?? 0,
      lastUsedAt: initial?.lastUsedAt,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      compatibleModels: compatibleModels.length > 0 ? compatibleModels : undefined,
    };
    onSave(prompt);
  };

  useEffect(() => { if (title.trim()) setErrors((e) => ({ ...e, title: undefined })); }, [title]);
  useEffect(() => { if (content.trim()) setErrors((e) => ({ ...e, content: undefined })); }, [content]);

  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 text-base rounded-lg border bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${
      err ? 'border-red-400' : 'border-[var(--color-border)]'
    }`;

  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2 opacity-70';

  return (
    <div className="flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden max-h-[90vh]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-amber-500" />
          <span className="font-bold text-base">
            {initial ? 'Edit Prompt' : 'New Prompt'}
          </span>
          {initial?.source === 'app' && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-400 font-medium">
              App
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────────────── */}
      <div className="flex overflow-hidden flex-1 min-h-0">

        {/* LEFT SIDEBAR */}
        <div className="w-[38%] shrink-0 border-r border-[var(--color-border)] overflow-y-auto px-4 py-4 space-y-5">

          {/* Folder */}
          <div>
            <label className={labelCls}>
              <Folder size={10} className="inline mr-1" />
              Folder
            </label>
            <FolderPickerDropdown
              folders={folders}
              value={folderId}
              onChange={setFolderId}
              onCreateFolder={onCreateFolder}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <CategoryPickerDropdown
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              onCreateCategory={onCreateCategory}
            />
          </div>

          {/* Model Compatibility */}
          <div>
            <label className={labelCls}>
              <Cpu size={10} className="inline mr-1" />
              Model Compatibility
            </label>
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
            <label className={labelCls}>
              <Tag size={10} className="inline mr-1" />
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                    selectedTagIds.includes(tag.id)
                      ? 'border-transparent text-white'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-amber-400'
                  }`}
                  style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            {onCreateTag && (
              <div className="flex gap-1.5">
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddTag(); } }}
                  placeholder="New tag…"
                  className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  onClick={() => void handleAddTag()}
                  disabled={!newTagName.trim()}
                  className="px-2 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT MAIN AREA */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* PROMPT IDENTITY */}
          <div>
            <label className={labelCls}>Prompt Identity</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Python Architect Persona"
              className={inputCls(errors.title)}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* PROMPT TEXT */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>Prompt Text</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-secondary)] opacity-50 uppercase tracking-wide">
                  Markdown supported
                </span>
                <button
                  type="button"
                  onClick={handleInsertVariable}
                  className="px-2 py-0.5 text-xs font-mono rounded border border-amber-400/50 text-amber-500 hover:bg-amber-500/10 transition-colors"
                  title="Insert variable placeholder at cursor"
                >
                  {'{{}}'}
                </button>
              </div>
            </div>
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'Enter the detailed instructions, system messages, and role definitions here...\n\nTip: use {{variable}} for dynamic values.'}
              rows={14}
              className={`w-full px-3 py-2.5 text-base rounded-lg border bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none transition-colors font-mono ${
                errors.content ? 'border-red-400' : 'border-[var(--color-border)]'
              }`}
            />
            {errors.content && <p className="text-sm text-red-500 mt-1">{errors.content}</p>}
            {detectedVars.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 items-center">
                <span className="text-xs text-[var(--color-text-secondary)] opacity-60">Variables:</span>
                {detectedVars.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium font-mono"
                  >
                    {'{{'}{v}{'}}'}
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] shrink-0">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span className="text-sm text-[var(--color-text)]">Favorite ⭐</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-base rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-base rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium"
          >
            {initial ? 'Save Changes' : 'Finalize Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}
