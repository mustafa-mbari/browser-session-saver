import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  items: MenuItem[];
  children: ReactNode;
}

export default function ContextMenu({ items, children }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on scroll so the menu doesn't drift from its anchor
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = items.length * 36 + 8; // approximate
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
      setPos({ top, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={triggerRef} className="relative">
      <div onClick={handleToggle}>{children}</div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-[9999] min-w-[160px] rounded-card bg-[var(--color-bg)] shadow-lg border border-[var(--color-border)] py-1"
            role="menu"
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={`
                    w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left
                    hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                    ${item.danger ? 'text-error' : 'text-[var(--color-text)]'}
                  `}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick();
                    setOpen(false);
                  }}
                >
                  {Icon && <Icon size={14} />}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
