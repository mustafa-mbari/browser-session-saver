import { useEffect, useState } from 'react';
import { Copy, Check, Pin, Sparkles, ArrowRight, Clock, PenLine, X, Share2 } from 'lucide-react';
import SharePromptModal from '@shared/components/SharePromptModal';
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
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [fillPrompt, setFillPrompt] = useState<Prompt | null>(null);
  const [sharingPrompt, setSharingPrompt] = useState<Prompt | null>(null);
  const setActiveView = useNewTabUIStore((s) => s.setActiveView);

  useEffect(() => {
    void PromptStorage.getAll().then((data) => {
      setPrompts(data);
      setLoaded(true);
    });

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && 'prompts' in changes) {
        void PromptStorage.getAll().then(setPrompts);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const pinned = PromptService.getPinnedPrompts(prompts).slice(0, 3);
  const recent = PromptService.getRecentPrompts(prompts, 3);

  const handleCopy = async (prompt: Prompt) => {
    await navigator.clipboard.writeText(prompt.content);
    await PromptStorage.trackUsage(prompt.id);
    setCopied(prompt.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFillCopy = async (filled: string, promptId: string) => {
    await navigator.clipboard.writeText(filled);
    await PromptStorage.trackUsage(promptId);
    setCopied(promptId);
    setFillPrompt(null);
    setTimeout(() => setCopied(null), 2000);
  };

  const isCompact = colSpan <= 2 && rowSpan <= 3;

  if (loaded && prompts.length === 0) {
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
    <>
      <div className="flex flex-col h-full overflow-hidden px-2 pb-2">
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
                  onFill={() => setFillPrompt(p)}
                  onShare={() => setSharingPrompt(p)}
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
                  onFill={() => setFillPrompt(p)}
                  onShare={() => setSharingPrompt(p)}
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

      {/* Fill Variables modal */}
      {fillPrompt && (
        <FillVariablesModal
          prompt={fillPrompt}
          onClose={() => setFillPrompt(null)}
          onCopy={(filled) => void handleFillCopy(filled, fillPrompt.id)}
        />
      )}

      {/* Share modal */}
      {sharingPrompt && (
        <SharePromptModal
          prompt={sharingPrompt}
          onClose={() => setSharingPrompt(null)}
        />
      )}
    </>
  );
}

function PromptRow({
  prompt,
  copied,
  onCopy,
  onFill,
  onShare,
  compact,
}: {
  prompt: Prompt;
  copied: string | null;
  onCopy: () => void;
  onFill: () => void;
  onShare: () => void;
  compact: boolean;
}) {
  const hasVariables = PromptService.extractVariables(prompt.content).length > 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg glass-hover group">
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
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {hasVariables && (
          <button
            onClick={onFill}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Fill variables & copy"
            style={{ color: 'var(--newtab-text)' }}
          >
            <PenLine size={12} />
          </button>
        )}
        <button
          onClick={onShare}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Share prompt"
          style={{ color: 'var(--newtab-text)' }}
        >
          <Share2 size={12} />
        </button>
        <button
          onClick={onCopy}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Copy to clipboard"
          style={{ color: 'var(--newtab-text)' }}
        >
          {copied === prompt.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

function FillVariablesModal({
  prompt,
  onClose,
  onCopy,
}: {
  prompt: Prompt;
  onClose: () => void;
  onCopy: (filled: string) => void;
}) {
  const variables = PromptService.extractVariables(prompt.content);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(variables.map((v) => [v, ''])),
  );
  const [copied, setCopied] = useState(false);

  const preview = PromptService.applyVariables(prompt.content, values);

  const handleCopy = async () => {
    setCopied(true);
    onCopy(preview);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl glass-panel rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-amber-400" />
            <span className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
              Fill Variables
            </span>
            <span className="text-xs opacity-50 truncate max-w-[200px]" style={{ color: 'var(--newtab-text)' }}>
              — {prompt.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
            style={{ color: 'var(--newtab-text)' }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Variable inputs */}
          <div className="w-[38%] shrink-0 border-r border-white/10 overflow-y-auto px-4 py-4 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-50" style={{ color: 'var(--newtab-text)' }}>
              Variables
            </p>
            {variables.map((v, i) => (
              <div key={v}>
                <label className="block text-xs font-mono text-amber-400 mb-1.5">
                  {'{{'}{v}{'}}'}
                </label>
                <input
                  autoFocus={i === 0}
                  value={values[v] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                  placeholder={`Enter ${v}…`}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-white/5 placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-400/60 transition-colors"
                  style={{ color: 'var(--newtab-text)' }}
                />
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col px-4 py-4 min-h-[240px]">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-1.5" style={{ color: 'var(--newtab-text)' }}>
              Preview
            </p>
            <textarea
              readOnly
              value={preview}
              className="flex-1 w-full px-3 py-2.5 text-xs rounded-lg border border-white/15 bg-white/5 resize-none focus:outline-none font-mono leading-relaxed opacity-80"
              style={{ color: 'var(--newtab-text)' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg border border-white/15 hover:bg-white/10 transition-colors"
            style={{ color: 'var(--newtab-text)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCopy()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}