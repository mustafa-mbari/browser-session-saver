import { Archive, Layers, LayoutGrid, FolderOpen, Sparkles, CreditCard, Globe, type LucideIcon } from 'lucide-react';
import type { HomeTab } from '../stores/sidepanel.store';

const WEB_APP_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://bh.mbari.de';

export interface MenuCard {
  key: HomeTab | 'web-app';
  label: string;
  icon: LucideIcon;
  href?: string;
}

export const MENU_CARDS: MenuCard[] = [
  { key: 'folders',       label: 'Folders',       icon: FolderOpen },
  { key: 'session',       label: 'Sessions',      icon: Archive },
  { key: 'tab-group',     label: 'Groups',        icon: LayoutGrid },
  { key: 'tab',           label: 'Tabs',          icon: Layers },
  { key: 'prompts',       label: 'Prompts',       icon: Sparkles },
  { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { key: 'web-app',       label: 'Web App',       icon: Globe, href: WEB_APP_URL },
];

interface MenuGridProps {
  onCardClick: (page: HomeTab) => void;
}

export default function MenuGrid({ onCardClick }: MenuGridProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3">
        {MENU_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              onClick={() => {
                if (card.href) {
                  window.open(card.href, '_blank', 'noopener,noreferrer');
                } else {
                  onCardClick(card.key as HomeTab);
                }
              }}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <Icon size={24} className="text-primary" />
              <span className="text-xs font-semibold text-[var(--color-text)]">{card.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
