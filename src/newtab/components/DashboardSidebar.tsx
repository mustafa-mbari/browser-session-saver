import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Clock,
  Layers,
  ArrowDownUp,
  Settings,
  Trash2,
  CreditCard,
  Sparkles,
  User,
  PanelLeft,
  Check,
  FolderOpen,
} from 'lucide-react';
import Tooltip from '@shared/components/Tooltip';
import ContextMenu from '@shared/components/ContextMenu';
import type { Board } from '@core/types/newtab.types';
import type { SidebarControl } from '@core/types/newtab.types';
import type { NewTabView } from '@newtab/stores/newtab.store';

function SectionLabel({ label }: { label: string }) {
  return (
    <span
      className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest block select-none"
      style={{ color: 'var(--newtab-text-secondary)', opacity: 0.45 }}
    >
      {label}
    </span>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
}

function NavItem({ icon, label, active, onClick, indent }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors w-full text-left ${
        active ? 'bg-white/20' : 'hover:bg-white/10'
      } ${indent ? 'pl-7' : ''}`}
      style={{ color: 'var(--newtab-text)' }}
    >
      <span className="shrink-0 opacity-60">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── Board item with inline rename ─────────────────────────────────────────────

interface BoardItemProps {
  board: Board;
  isActive: boolean;
  isProtected: boolean;
  onSelect: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function BoardItem({ board, isActive, isProtected, onSelect, onRename, onDelete }: BoardItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(board.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const name = draft.trim() || board.name;
    onRename(board.id, name);
    setRenaming(false);
  };

  const menuItems = [
    {
      label: 'Rename',
      icon: Pencil,
      onClick: () => { setDraft(board.name); setRenaming(true); setTimeout(() => inputRef.current?.focus(), 0); },
    },
    {
      label: 'Delete Board',
      icon: Trash2,
      onClick: () => onDelete(board.id),
      danger: true,
    },
  ];

  return (
    // The entire row is the click target. The ⋯ button and rename input stop propagation
    // so they don't accidentally trigger board selection.
    <div
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors group cursor-pointer ${
        isActive ? 'bg-white/20' : 'hover:bg-white/10'
      }`}
      onClick={() => { if (!renaming) onSelect(); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !renaming) { e.preventDefault(); onSelect(); }
      }}
    >
      <span className="text-base shrink-0">{board.icon}</span>

      {renaming ? (
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(board.name); setRenaming(false); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-white/10 rounded px-1 py-0 text-sm outline-none"
          style={{ color: 'var(--newtab-text)' }}
        />
      ) : (
        <span
          className="flex-1 min-w-0 truncate"
          style={{ color: 'var(--newtab-text)' }}
        >
          {board.name}
        </span>
      )}

      {/* Protected boards (Main) have no context menu */}
      {!renaming && !isProtected && (
        <div onClick={(e) => e.stopPropagation()}>
          <ContextMenu items={menuItems}>
            <button
              className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              aria-label="Board options"
            >
              <MoreHorizontal size={13} style={{ color: 'var(--newtab-text-secondary)' }} />
            </button>
          </ContextMenu>
        </div>
      )}
    </div>
  );
}

// ── Sidebar control popup ──────────────────────────────────────────────────────

const CONTROL_OPTIONS: { value: SidebarControl; label: string }[] = [
  { value: 'expanded',        label: 'Expanded' },
  { value: 'collapsed',       label: 'Collapsed' },
  { value: 'expand-on-hover', label: 'Expand on hover' },
];

function SidebarControlPopup({
  value,
  anchorRef,
  onChange,
  onClose,
}: {
  value: SidebarControl;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onChange: (mode: SidebarControl) => void;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 8, left: rect.right + 8 });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !popupRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={popupRef}
      className="glass-panel rounded-xl py-1.5 min-w-[190px]"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 99999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        transform: 'translateY(-100%)',
      }}
    >
      <p
        className="px-3 pt-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}
      >
        Sidebar control
      </p>
      {CONTROL_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => { onChange(opt.value); onClose(); }}
          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/10 transition-colors"
          style={{ color: 'var(--newtab-text)' }}
        >
          {opt.label}
          {value === opt.value && <Check size={13} style={{ color: '#818cf8' }} />}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

interface Props {
  boards: Board[];
  activeBoard: Board | null;
  collapsed: boolean;
  activeView: NewTabView;
  onSelectBoard: (board: Board) => void;
  onToggle: () => void;
  onNewBoard: () => void;
  onViewChange: (view: NewTabView) => void;
  onRenameBoard: (id: string, name: string) => void;
  onDeleteBoard: (id: string) => void;
  sidebarControl?: SidebarControl;
  onSidebarControlChange?: (mode: SidebarControl) => void;
}

export default function DashboardSidebar({
  boards,
  activeBoard,
  collapsed: _collapsed,
  activeView,
  onSelectBoard,
  onToggle,
  onNewBoard,
  onViewChange,
  onRenameBoard,
  onDeleteBoard,
  sidebarControl = 'expand-on-hover',
  onSidebarControlChange,
}: Props) {
  const [sessionsExpanded, setSessionsExpanded] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const controlBtnRef = useRef<HTMLButtonElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True for the full 2 s window — never cancelled by hover interactions
  const autoOpenActiveRef = useRef(false);
  // Tracks whether the mouse is currently physically over the sidebar
  const isMouseOverRef = useRef(false);

  // Auto-open on mount for expand-on-hover mode, collapse after 2 s
  useEffect(() => {
    if (sidebarControl === 'expand-on-hover') {
      setIsHovering(true);
      autoOpenActiveRef.current = true;
      autoOpenTimerRef.current = setTimeout(() => {
        autoOpenTimerRef.current = null;
        autoOpenActiveRef.current = false;
        // Only close if the mouse is not currently over the sidebar
        if (!isMouseOverRef.current) {
          setIsHovering(false);
        }
      }, 2000);
    }
    return () => {
      if (autoOpenTimerRef.current) clearTimeout(autoOpenTimerRef.current);
      autoOpenActiveRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive effective collapsed state from sidebarControl mode
  const effectiveCollapsed =
    sidebarControl === 'expanded' ? false :
    sidebarControl === 'collapsed' ? true :
    !isHovering; // expand-on-hover

  const handleMouseEnter = () => {
    if (sidebarControl !== 'expand-on-hover') return;
    isMouseOverRef.current = true;
    // During auto-open window the sidebar is already open — don't start hover timer
    if (autoOpenActiveRef.current) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => setIsHovering(true), 300);
  };
  const handleMouseLeave = () => {
    if (sidebarControl !== 'expand-on-hover' || controlOpen) return;
    isMouseOverRef.current = false;
    // During auto-open window keep the sidebar open regardless of mouse position
    if (autoOpenActiveRef.current) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovering(false);
  };

  if (effectiveCollapsed) {
    return (
      <div
        className="glass-panel h-full flex flex-col items-center py-4 gap-1 border-r border-white/10 w-12 shrink-0"
        style={{ transition: 'width 0.2s ease' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => {
            if (onSidebarControlChange) {
              onSidebarControlChange('expanded');
            } else {
              onToggle();
            }
          }}
          className="p-1 rounded hover:bg-white/10 transition-colors mb-2"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={16} style={{ color: 'var(--newtab-text-secondary)' }} />
        </button>
        {boards.map((board) => (
          <Tooltip key={board.id} content={board.name} position="right">
            <button
              onClick={() => { onSelectBoard(board); onViewChange('bookmarks'); }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeBoard?.id === board.id && activeView === 'bookmarks' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <span className="text-sm">{board.icon}</span>
            </button>
          </Tooltip>
        ))}
        <div className="w-full border-t border-white/10 my-1" />
        {[
          { view: 'folder-explorer' as NewTabView, icon: <FolderOpen size={14} />, label: 'Folders' },
          { view: 'sessions' as NewTabView, icon: <Clock size={14} />, label: 'Sessions' },
          { view: 'tab-groups' as NewTabView, icon: <Layers size={13} />, label: 'Tab Groups' },
          { view: 'import-export' as NewTabView, icon: <ArrowDownUp size={13} />, label: 'Import/Export' },
          { view: 'settings' as NewTabView, icon: <Settings size={13} />, label: 'Settings' },
        ].map(({ view, icon, label }) => (
          <Tooltip key={view} content={label} position="right">
            <button
              onClick={() => onViewChange(view)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeView === view ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              aria-label={label}
            >
              <span style={{ color: 'var(--newtab-text-secondary)' }}>{icon}</span>
            </button>
          </Tooltip>
        ))}
        <div className="w-full border-t border-white/10 my-1" />
        <Tooltip content="Subscriptions" position="right">
          <button
            onClick={() => onViewChange('subscriptions')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'subscriptions' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
            aria-label="Subscriptions"
          >
            <CreditCard size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
        </Tooltip>
        <Tooltip content="Prompts" position="right">
          <button
            onClick={() => onViewChange('prompts')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'prompts' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
            aria-label="Prompts"
          >
            <Sparkles size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
        </Tooltip>
        <div className="mt-auto pt-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <User size={14} style={{ color: '#818cf8' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass-panel h-full flex flex-col border-r border-white/10 w-60 shrink-0 overflow-y-auto"
      style={{ transition: 'width 0.2s ease' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header — "Menu" glassy label */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
        <span
          className="text-xs font-bold uppercase tracking-widest select-none"
          style={{ color: 'var(--newtab-text-secondary)', opacity: 0.45 }}
        >
          Menu
        </span>
        <button
          onClick={() => onSidebarControlChange ? onSidebarControlChange('collapsed') : onToggle()}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
        </button>
      </div>

      {/* ── BOARDS ── */}
      <SectionLabel label="Boards" />
      <div className="flex flex-col gap-0.5 px-2">
        {boards.map((board, idx) => (
          <BoardItem
            key={board.id}
            board={board}
            isActive={activeBoard?.id === board.id && activeView === 'bookmarks'}
            isProtected={idx === 0}
            onSelect={() => { onSelectBoard(board); onViewChange('bookmarks'); }}
            onRename={onRenameBoard}
            onDelete={onDeleteBoard}
          />
        ))}
        <button
          onClick={onNewBoard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-white/10 transition-colors w-full text-left opacity-55 hover:opacity-100"
          style={{ color: 'var(--newtab-text-secondary)' }}
        >
          <Plus size={13} />
          <span>New Board</span>
        </button>
      </div>

      {/* ── SESSION SAVER ── */}
      <div className="mt-1">
        <button
          onClick={() => setSessionsExpanded((v) => !v)}
          className="flex items-center gap-1.5 px-3 pt-3 pb-1 w-full text-left"
          aria-expanded={sessionsExpanded}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-widest flex-1 select-none"
            style={{ color: 'var(--newtab-text-secondary)', opacity: 0.45 }}
          >
            Browser Hub
          </span>
          <ChevronDown
            size={11}
            className={`transition-transform ${sessionsExpanded ? '' : '-rotate-90'}`}
            style={{ color: 'var(--newtab-text-secondary)', opacity: 0.4 }}
          />
        </button>

        {sessionsExpanded && (
          <div className="flex flex-col gap-0.5 px-2">
            <NavItem
              icon={<FolderOpen size={13} />}
              label="Folders"
              active={activeView === 'folder-explorer'}
              onClick={() => onViewChange('folder-explorer')}
            />
            <NavItem
              icon={<Clock size={13} />}
              label="Sessions"
              active={activeView === 'sessions'}
              onClick={() => onViewChange('sessions')}
            />
            <NavItem
              icon={<Layers size={13} />}
              label="Tab Groups"
              active={activeView === 'tab-groups'}
              onClick={() => onViewChange('tab-groups')}
            />
            <NavItem
              icon={<ArrowDownUp size={13} />}
              label="Import / Export"
              active={activeView === 'import-export'}
              onClick={() => onViewChange('import-export')}
            />
            <NavItem
              icon={<Settings size={13} />}
              label="Settings"
              active={activeView === 'settings'}
              onClick={() => onViewChange('settings')}
            />
          </div>
        )}
      </div>

      {/* ── SUBSCRIPTIONS ── */}
      <div className="mt-1">
        <SectionLabel label="Subscriptions" />
        <div className="flex flex-col gap-0.5 px-2">
          <NavItem
            icon={<CreditCard size={13} />}
            label="Manage Subscriptions"
            active={activeView === 'subscriptions'}
            onClick={() => onViewChange('subscriptions')}
          />
        </div>
      </div>

      {/* ── PROMPTS ── */}
      <div className="mt-1">
        <SectionLabel label="Prompts" />
        <div className="flex flex-col gap-0.5 px-2">
          <NavItem
            icon={<Sparkles size={13} />}
            label="Manage Prompts"
            active={activeView === 'prompts'}
            onClick={() => onViewChange('prompts')}
          />
        </div>
      </div>

      {/* ── ACCOUNT + SIDEBAR CONTROL ── */}
      <div className="border-t border-white/10 mt-auto shrink-0">
        {/* Account row */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <User size={15} style={{ color: '#818cf8' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--newtab-text)' }}>
              Chrome User
            </div>
            <div className="text-[10px] truncate" style={{ color: 'var(--newtab-text-secondary)' }}>
              Browser Hub
            </div>
          </div>
        </div>

        {/* Sidebar control button */}
        <div className="px-2 pb-2">
          <button
            ref={controlBtnRef}
            onClick={() => setControlOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-white/10 transition-colors w-full text-left"
            style={{ color: 'var(--newtab-text-secondary)', opacity: 0.65 }}
          >
            <PanelLeft size={13} className="shrink-0" />
            <span>Sidebar control</span>
          </button>
        </div>
      </div>

      {/* Sidebar control popup */}
      {controlOpen && (
        <SidebarControlPopup
          value={sidebarControl}
          anchorRef={controlBtnRef}
          onChange={(mode) => {
            onSidebarControlChange?.(mode);
            setIsHovering(false);
          }}
          onClose={() => setControlOpen(false)}
        />
      )}
    </div>
  );
}
