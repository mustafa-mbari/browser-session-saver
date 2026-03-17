import { useRef, useState } from 'react';
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
  User,
} from 'lucide-react';
import Tooltip from '@shared/components/Tooltip';
import ContextMenu from '@shared/components/ContextMenu';
import type { Board } from '@core/types/newtab.types';
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
  onSelect: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function BoardItem({ board, isActive, onSelect, onRename, onDelete }: BoardItemProps) {
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
    <div
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors group ${
        isActive ? 'bg-white/20' : 'hover:bg-white/10'
      }`}
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
        <button
          className="flex-1 min-w-0 text-left truncate"
          style={{ color: 'var(--newtab-text)' }}
          onClick={onSelect}
        >
          {board.name}
        </button>
      )}

      {!renaming && (
        <ContextMenu items={menuItems}>
          <button
            className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
            aria-label="Board options"
          >
            <MoreHorizontal size={13} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
        </ContextMenu>
      )}
    </div>
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
}

export default function DashboardSidebar({
  boards,
  activeBoard,
  collapsed,
  activeView,
  onSelectBoard,
  onToggle,
  onNewBoard,
  onViewChange,
  onRenameBoard,
  onDeleteBoard,
}: Props) {
  const [sessionsExpanded, setSessionsExpanded] = useState(true);

  if (collapsed) {
    return (
      <div className="glass-panel h-full flex flex-col items-center py-4 gap-1 border-r border-white/10 w-12 shrink-0">
        <button
          onClick={onToggle}
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
    <div className="glass-panel h-full flex flex-col border-r border-white/10 w-60 shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <img src="/icons/bs_logo.png" alt="Session Saver" className="w-5 h-5 rounded" />
          <span className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
            Session Saver
          </span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={14} style={{ color: 'var(--newtab-text-secondary)' }} />
        </button>
      </div>

      {/* ── BOARDS ── */}
      <SectionLabel label="Boards" />
      <div className="flex flex-col gap-0.5 px-2">
        {boards.map((board) => (
          <BoardItem
            key={board.id}
            board={board}
            isActive={activeBoard?.id === board.id && activeView === 'bookmarks'}
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
            Session Saver
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

      {/* ── ACCOUNT ── */}
      <div className="border-t border-white/10 mt-auto shrink-0">
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
              Session Saver
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
