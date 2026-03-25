import { useState } from 'react';
import { Copy, Check, Pencil, Trash2, Pin, PinOff, Star, ChevronDown, ChevronUp, Zap, Monitor, Globe } from 'lucide-react';
import type { Prompt, PromptTag, PromptCategory } from '@core/types/prompt.types';
import { PromptService } from '@core/services/prompt.service';

interface PromptCardProps {
  prompt: Prompt;
  tags: PromptTag[];
  categories: PromptCategory[];
  onEdit: (p: Prompt) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCopy: (id: string) => void;
  onUse: (p: Prompt) => void;
}

export default function PromptCard({
  prompt,
  tags,
  categories,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onCopy,
  onUse,
}: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const promptTags = tags.filter((t) => prompt.tags.includes(t.id));
  const category = categories.find((c) => c.id === prompt.categoryId);
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
    if (confirmDelete) {
      onDelete(prompt.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all glass ${
        prompt.isPinned
          ? 'border-amber-300 dark:border-amber-700'
          : 'border-[var(--color-border)]'
      }`}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-2.5 py-2.5 flex items-start gap-2"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {prompt.isPinned && (
              <Pin size={12} className="text-amber-500 shrink-0" />
            )}
            <span className="text-base font-semibold text-[var(--color-text)] truncate">
              {prompt.title}
            </span>
            {prompt.isFavorite && (
              <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />
            )}
          </div>
          {!expanded && (
            <p className="text-sm text-[var(--color-text-secondary)] truncate">
              {prompt.content}
            </p>
          )}
          {/* Tag chips */}
          {promptTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
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
        <div className="shrink-0 text-[var(--color-text-secondary)] mt-0.5">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-[var(--color-border)]">
          {/* Full content */}
          <div className="mt-2 rounded-lg bg-[var(--color-bg-secondary)] p-3">
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words leading-relaxed">
              {prompt.content}
            </p>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            {/* Source badge */}
            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${
              prompt.source === 'app'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}>
              {prompt.source === 'app' ? <Globe size={11} /> : <Monitor size={11} />}
              {prompt.source === 'app' ? 'App' : 'Local'}
            </span>
            {category && (
              <span className="flex items-center gap-1">
                {category.icon} {category.name}
              </span>
            )}
            {prompt.usageCount > 0 && (
              <span>Used {prompt.usageCount}×</span>
            )}
            {hasVars && (
              <span className="text-amber-500">Has variables</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1">
            {/* Copy */}
            <button
              onClick={(e) => void handleCopy(e)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {/* Use (with variable fill-in) */}
            {hasVars && (
              <button
                onClick={(e) => { e.stopPropagation(); onUse(prompt); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text)] transition-colors"
                title="Fill variables and copy"
              >
                <Zap size={12} />
                Use
              </button>
            )}

            {/* Edit */}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(prompt); }}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors"
              title="Edit"
            >
              <Pencil size={12} />
            </button>

            {/* Pin toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(prompt.id); }}
              className={`p-1.5 rounded-lg border transition-colors ${
                prompt.isPinned
                  ? 'border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
              title={prompt.isPinned ? 'Unpin' : 'Pin'}
            >
              {prompt.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>

            {/* Favorite toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(prompt.id); }}
              className={`p-1.5 rounded-lg border transition-colors ${
                prompt.isFavorite
                  ? 'border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
              title={prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={12} className={prompt.isFavorite ? 'fill-amber-400' : ''} />
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className={`ml-auto p-1.5 rounded-lg border transition-colors ${
                confirmDelete
                  ? 'border-red-400 text-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-red-300 hover:text-red-500'
              }`}
              title={confirmDelete ? 'Click again to confirm' : 'Delete'}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
