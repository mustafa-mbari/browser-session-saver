import { SUBSCRIPTION_TEMPLATES, CATEGORY_LABELS } from '@core/types/subscription.types';
import type { SubscriptionTemplate } from '@core/types/subscription.types';
import { resolveFavIcon, getFaviconInitial } from '@core/utils/favicon';
import { useState } from 'react';

interface Props {
  onSelect: (template: SubscriptionTemplate) => void;
  onClose: () => void;
}

function TemplateFavicon({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = url ? resolveFavIcon('', url) : '';

  if (!faviconUrl || failed) {
    return (
      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold text-sm">
        {getFaviconInitial(name, url ?? '')}
      </span>
    );
  }
  return (
    <img
      src={faviconUrl}
      alt={name}
      className="w-8 h-8 rounded-lg object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export default function QuickAddTemplates({ onSelect, onClose }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Choose a template</h3>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-2 py-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="grid grid-cols-2 gap-2">
          {SUBSCRIPTION_TEMPLATES.map((template) => (
            <button
              key={template.name}
              onClick={() => onSelect(template)}
              className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] hover:border-violet-400 transition-all text-left"
            >
              <TemplateFavicon url={template.url} name={template.name} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-[var(--color-text)] truncate leading-tight">
                  {template.name}
                </span>
                <span className="text-[10px] text-[var(--color-text-secondary)] leading-tight">
                  {CATEGORY_LABELS[template.category]} · {template.currency} {template.defaultPrice}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
