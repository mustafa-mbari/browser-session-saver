import { useState, useEffect } from 'react';
import { X, Tag, FolderOpen, Sparkles, Monitor, Globe } from 'lucide-react';
import type { Prompt, PromptCategory, PromptFolder, PromptTag } from '@core/types/prompt.types';
import { PromptService } from '@core/services/prompt.service';
import { generateId } from '@core/utils/uuid';

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
}

export default function PromptForm({
  initial,
  categories,
  tags,
  folders,
  defaultFolderId,
  defaultSource,
  onSave,
  onClose,
  onCreateTag,
  onCreateCategory,
}: PromptFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [folderId, setFolderId] = useState(initial?.folderId ?? defaultFolderId ?? '');
  const [source, setSource] = useState<'local' | 'app'>(initial?.source ?? defaultSource ?? 'local');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initial?.tags ?? []);
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [newTagName, setNewTagName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  const detectedVars = PromptService.extractVariables(content);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name || !onCreateTag) return;
    const tag = await onCreateTag(name);
    setSelectedTagIds((prev) => [...prev, tag.id]);
    setNewTagName('');
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name || !onCreateCategory) return;
    const cat = await onCreateCategory(name);
    setCategoryId(cat.id);
    setNewCatName('');
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
      description: description.trim() || undefined,
      categoryId: categoryId || undefined,
      folderId: folderId || undefined,
      source,
      tags: selectedTagIds,
      isFavorite,
      isPinned: initial?.isPinned ?? false,
      usageCount: initial?.usageCount ?? 0,
      lastUsedAt: initial?.lastUsedAt,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(prompt);
  };

  // Clear error on edit
  useEffect(() => { if (title.trim()) setErrors((e) => ({ ...e, title: undefined })); }, [title]);
  useEffect(() => { if (content.trim()) setErrors((e) => ({ ...e, content: undefined })); }, [content]);

  // Build indented folder options for select
  const folderOptions: { id: string; label: string }[] = [];
  function addFolderOptions(parentId: string | undefined, depth: number) {
    const children = folders
      .filter((f) => (f.parentId ?? undefined) === parentId)
      .sort((a, b) => a.position - b.position);
    for (const f of children) {
      folderOptions.push({ id: f.id, label: `${'—'.repeat(depth)} ${f.name}` });
      addFolderOptions(f.id, depth + 1);
    }
  }
  addFolderOptions(undefined, 0);

  return (
    <div className="flex flex-col h-full glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          <span className="font-semibold text-sm">
            {initial ? 'Edit Prompt' : 'New Prompt'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Write a blog post intro"
            className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${
              errors.title ? 'border-red-400' : 'border-[var(--color-border)]'
            }`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Content <span className="text-red-500">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'Write a blog post about {{topic}} for {{audience}}...'}
            rows={6}
            className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none transition-colors ${
              errors.content ? 'border-red-400' : 'border-[var(--color-border)]'
            }`}
          />
          {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content}</p>}

          {/* Detected variables */}
          {detectedVars.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-xs text-[var(--color-text-secondary)]">Variables:</span>
              {detectedVars.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium"
                >
                  {'{{'}{v}{'}}'}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Description (optional)
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of this prompt"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          />
        </div>

        {/* Source + Folder row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Source
            </label>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setSource('local')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs transition-colors ${
                  source === 'local'
                    ? 'bg-amber-500 text-white font-medium'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <Monitor size={11} /> Local
              </button>
              <button
                type="button"
                onClick={() => setSource('app')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs transition-colors border-l border-[var(--color-border)] ${
                  source === 'app'
                    ? 'bg-amber-500 text-white font-medium'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <Globe size={11} /> App
              </button>
            </div>
          </div>

          {/* Folder */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              <FolderOpen size={11} className="inline mr-1" />
              Folder
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
            >
              <option value="">No folder</option>
              {folderOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          {onCreateCategory && (
            <div className="flex gap-2 mt-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddCategory(); } }}
                placeholder="New category name..."
                className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                onClick={() => void handleAddCategory()}
                disabled={!newCatName.trim()}
                className="px-2 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
            <Tag size={11} className="inline mr-1" />
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  selectedTagIds.includes(tag.id)
                    ? 'border-transparent text-white'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-amber-400'
                }`}
                style={
                  selectedTagIds.includes(tag.id)
                    ? { backgroundColor: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
          {onCreateTag && (
            <div className="flex gap-2">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddTag(); } }}
                placeholder="New tag name..."
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

        {/* Favorite */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span className="text-sm text-[var(--color-text)]">Mark as favorite ⭐</span>
        </label>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium"
        >
          {initial ? 'Save Changes' : 'Create Prompt'}
        </button>
      </div>
    </div>
  );
}
