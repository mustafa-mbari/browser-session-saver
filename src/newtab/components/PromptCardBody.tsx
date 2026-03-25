import { useEffect, useState } from 'react';
import { Copy, Check, Pin, Sparkles, ArrowRight, Clock } from 'lucide-react';
import type { SpanValue } from '@core/types/newtab.types';
import type { Prompt } from '@core/types/prompt.types';
import { PromptStorage } from '@core/storage/prompt-storage';
import { PromptService } from '@core/services/prompt.service';
import { useNewTabUIStore } from '@newtab/stores/newtab.store';

interface Props {
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function PromptCardBody({ colSpan, rowSpan }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const setActiveView = useNewTabUIStore((s) => s.setActiveView);

  useEffect(() => {
    void PromptStorage.getAll().then(setPrompts);
  }, []);

  const pinned = PromptService.getPinnedPrompts(prompts).slice(0, 3);
  const recent = PromptService.getRecentPrompts(prompts, 3);

  const handleCopy = async (prompt: Prompt) => {
    await navigator.clipboard.writeText(prompt.content);
    await PromptStorage.trackUsage(prompt.id);
    setCopied(prompt.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const isCompact = colSpan <= 2 && rowSpan <= 3;

  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-4 text-center">
        <Sparkles size={24} className="text-amber-400 opacity-60 mb-2" />
        <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
          No prompts yet
        </p>
        <button
          onClick={() => setActiveView('prompts')}
          className="mt-2 px-3 py-1 rounded-lg text-xs bg-amber-500/80 text-white hover:bg-amber-500 transition-colors"
        >
          Add Prompts
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Pinned section */}
      {pinned.length > 0 && (
        <div className="mb-2">
          {!isCompact && (
            <div className="flex items-center gap-1 mb-1">
              <Pin size={10} className="text-amber-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60" style={{ color: 'var(--newtab-text)' }}>
                Pinned
              </span>
            </div>
          )}
          <div className="space-y-1">
            {pinned.map((p) => (
              <PromptRow
                key={p.id}
                prompt={p}
                copied={copied}
                onCopy={() => void handleCopy(p)}
                compact={isCompact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent section */}
      {recent.length > 0 && !isCompact && (
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-1">
            <Clock size={10} className="opacity-60" style={{ color: 'var(--newtab-text)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60" style={{ color: 'var(--newtab-text)' }}>
              Recent
            </span>
          </div>
          <div className="space-y-1">
            {recent.map((p) => (
              <PromptRow
                key={p.id}
                prompt={p}
                copied={copied}
                onCopy={() => void handleCopy(p)}
                compact={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer link */}
      <div className="mt-auto pt-1 border-t border-white/10">
        <button
          onClick={() => setActiveView('prompts')}
          className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-90 transition-opacity"
          style={{ color: 'var(--newtab-text)' }}
        >
          Open Prompt Manager
          <ArrowRight size={10} />
        </button>
      </div>
    </div>
  );
}

function PromptRow({
  prompt,
  copied,
  onCopy,
  compact,
}: {
  prompt: Prompt;
  copied: string | null;
  onCopy: () => void;
  compact: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg glass-hover group">
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium truncate"
          style={{ color: 'var(--newtab-text)' }}
        >
          {prompt.title}
        </p>
        {!compact && (
          <p
            className="text-[10px] truncate opacity-60"
            style={{ color: 'var(--newtab-text-secondary)' }}
          >
            {prompt.content}
          </p>
        )}
      </div>
      <button
        onClick={onCopy}
        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
        title="Copy to clipboard"
        style={{ color: 'var(--newtab-text)' }}
      >
        {copied === prompt.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
