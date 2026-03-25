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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative w-full max-w-md rounded-2xl glass-panel shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="font-semibold text-sm">Fill Variables</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Variable inputs */}
          {variables.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Fill in the variables below:
              </p>
              {variables.map((v) => (
                <div key={v}>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    <span className="font-mono text-amber-600 dark:text-amber-400">
                      {'{{'}{v}{'}}'}
                    </span>
                  </label>
                  <input
                    value={values[v] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                    placeholder={`Enter ${v}...`}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
              Preview:
            </p>
            <div className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
              <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words leading-relaxed">
                {preview}
              </p>
            </div>
          </div>
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
            onClick={() => void handleCopy()}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Final Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}
