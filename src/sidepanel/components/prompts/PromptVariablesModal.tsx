import { useState } from 'react';
import { X, Copy, Check, Sparkles } from 'lucide-react';
import type { Prompt } from '@core/types/prompt.types';
import { PromptService } from '@core/services/prompt.service';

interface PromptVariablesModalProps {
  prompt: Prompt;
  onClose: () => void;
  onCopy: (id: string) => void;
}

export default function PromptVariablesModal({ prompt, onClose, onCopy }: PromptVariablesModalProps) {
  const variables = PromptService.extractVariables(prompt.content);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(variables.map((v) => [v, ''])),
  );
  const [copied, setCopied] = useState(false);

  const preview = PromptService.applyVariables(prompt.content, values);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
    onCopy(prompt.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] opacity-70 mb-2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative w-full max-w-3xl flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles size={17} className="text-amber-500" />
            <span className="font-bold text-base text-[var(--color-text)]">Fill Variables</span>
            <span className="text-sm text-[var(--color-text-secondary)] opacity-60 truncate max-w-[240px]">
              — {prompt.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-secondary)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0 overflow-hidden min-h-[420px]">
          {/* Left: variable inputs */}
          <div className="w-[38%] shrink-0 border-r border-[var(--color-border)] overflow-y-auto px-5 py-5 space-y-5">
            <p className={labelCls}>Variables</p>
            {variables.map((v) => (
              <div key={v}>
                <label className="block text-sm font-mono text-amber-500 mb-2">
                  {'{{'}{v}{'}}'}
                </label>
                <input
                  autoFocus={variables[0] === v}
                  value={values[v] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                  placeholder={`Enter ${v}…`}
                  className="w-full px-3 py-2.5 text-base rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Right: prompt preview */}
          <div className="flex-1 flex flex-col px-5 py-5">
            <p className={labelCls}>Prompt Text</p>
            <textarea
              readOnly
              value={preview}
              className="flex-1 w-full px-4 py-3 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] resize-none focus:outline-none font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-base rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCopy()}
            className="flex items-center gap-2 px-5 py-2 text-base rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Final'}
          </button>
        </div>
      </div>
    </div>
  );
}
