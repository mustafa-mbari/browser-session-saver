import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  // Focus first item when menu opens
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      // Defer focus so the portal has rendered
      requestAnimationFrame(() => {
        itemRefs.current[0]?.focus();
      });
    }
  }, [open]);

  const openMenu = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = items.length * 36 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
    setPos({ top, right: window.innerWidth - rect.right });
    setOpen(true);
  }, [items.length]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    if (open) {
      e.stopPropagation();
      setOpen(false);
    } else {
      openMenu(e);
    }
  }, [open, openMenu]);

  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) openMenu(e);
    } else if (e.key === 'Escape' && open) {
      setOpen(false);
      triggerRef.current?.querySelector('button')?.focus();
    }
  }, [open, openMenu]);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.querySelector('button')?.focus();
        break;

      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = (prev + 1) % items.length;
          itemRefs.current[next]?.focus();
          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = (prev - 1 + items.length) % items.length;
          itemRefs.current[next]?.focus();
          return next;
        });
        break;

      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        itemRefs.current[0]?.focus();
        break;

      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        itemRefs.current[items.length - 1]?.focus();
        break;

      case 'Tab':
        // Close and return focus to trigger on Tab out
        setOpen(false);
        break;
    }
  }, [items.length]);

  return (
    <div ref={triggerRef} className="relative">
      <div
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        role="presentation"
      >
        {children}
      </div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-[9999] min-w-[160px] rounded-card bg-[var(--color-bg)] shadow-lg border border-[var(--color-border)] py-1"
            role="menu"
            aria-orientation="vertical"
            onKeyDown={handleMenuKeyDown}
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left
                    hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                    focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                    ${item.danger ? 'text-error' : 'text-[var(--color-text)]'}
                  `}
                  role="menuitem"
                  tabIndex={activeIndex === index ? 0 : -1}
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
