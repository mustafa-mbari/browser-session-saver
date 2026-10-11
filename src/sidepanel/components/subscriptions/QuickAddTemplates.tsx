import { SUBSCRIPTION_TEMPLATES, CATEGORY_LABELS } from '@core/types/subscription.types';
import type { SubscriptionTemplate } from '@core/types/subscription.types';
import { resolveFavIcon, getFaviconInitial, getChromeInternalFaviconUrl, getFaviconFallbackUrl } from '@core/utils/favicon';
import { useState } from 'react';

interface Props {
  onSelect: (template: SubscriptionTemplate) => void;
  onClose: () => void;
}

function TemplateFavicon({ url, name }: { url?: string; name: string }) {
  const [tryIdx, setTryIdx] = useState(0);
  const sources = url
    ? [resolveFavIcon('', url), getChromeInternalFaviconUrl(url), getFaviconFallbackUrl(url)].filter(Boolean)
    : [];
  const src = sources[tryIdx] ?? '';

  if (!src) {
    return (
      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold text-sm">
        {getFaviconInitial(name, url ?? '')}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      className="w-8 h-8 rounded-lg object-contain"
      onError={() => setTryIdx((i) => i + 1)}
    />
  );
}

export default function QuickAddTemplates({ onSelect, onClose }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-(--color-border)">
        <h3 className="text-sm font-semibold text-(--color-text)">Choose a template</h3>
        <button
          onClick={onClose}
          className="text-xs text-(--color-text-secondary) hover:text-(--color-text) px-2 py-1 rounded-sm hover:bg-(--color-bg-secondary) transition-colors"
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
              className="flex items-center gap-2.5 p-2.5 rounded-lg bg-(--color-bg-secondary) hover:bg-(--color-bg-hover) border border-(--color-border) hover:border-violet-400 transition-all text-left"
            >
              <TemplateFavicon url={template.url} name={template.name} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-(--color-text) truncate leading-tight">
                  {template.name}
                </span>
                <span className="text-[10px] text-(--color-text-secondary) leading-tight">
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
