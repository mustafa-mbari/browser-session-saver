import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Clock,
  Bookmark,
  Layers,
  ArrowDownUp,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Tooltip from '@shared/components/Tooltip';
import ContextMenu from '@shared/components/ContextMenu';
import type { Board } from '@core/types/newtab.types';
import type { NewTabView } from '@newtab/stores/newtab.store';

interface NativeNode {
  id: string;
  title: string;
  url?: string;
  children?: NativeNode[];
}

function NativeBookmarkTree({ nodes, depth = 0 }: { nodes: NativeNode[]; depth?: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      {nodes.map((node) => {
        const isFolder = !node.url;
        const isOpen = expanded.has(node.id);
        return (
          <div key={node.id}>
            {isFolder ? (
              <button
                className="flex items-center gap-1 w-full text-left py-1 px-2 rounded hover:bg-white/10 text-xs transition-colors"
                style={{ color: 'var(--newtab-text-secondary)' }}
                onClick={() => toggle(node.id)}
              >
                {isOpen ? '▾' : '▸'} {node.title || 'Folder'}
              </button>
            ) : (
              <a
                href={node.url}
                className="flex items-center gap-2 py-1 px-2 rounded hover:bg-white/10 text-xs transition-colors truncate"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${(() => {
                    try { return new URL(node.url ?? '').hostname; }
                    catch { return 'example.com'; }
                  })()}&sz=16`}
                  alt=""
                  className="w-3 h-3 rounded shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                {node.title || node.url}
              </a>
            )}
            {isFolder && isOpen && node.children && (
              <NativeBookmarkTree nodes={node.children} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [nativeTree, setNativeTree] = useState<NativeNode[]>([]);
  const [showNative, setShowNative] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(true);

  useEffect(() => {
    if (!showNative) return;
    chrome.bookmarks.getTree((tree) => { setNativeTree(tree as NativeNode[]); });
  }, [showNative]);

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
          { view: 'auto-saves' as NewTabView, icon: <RefreshCw size={13} />, label: 'Auto-Saves' },
          { view: 'tab-groups' as NewTabView, icon: <Layers size={13} />, label: 'Tab Groups' },
          { view: 'import-export' as NewTabView, icon: <ArrowDownUp size={13} />, label: 'Import/Export' },
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
      </div>
    );
  }

  return (
    <div className="glass-panel h-full flex flex-col border-r border-white/10 w-60 shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
        <span className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
          Session Saver
        </span>
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
              icon={<RefreshCw size={13} />}
              label="Auto-Saves"
              active={activeView === 'auto-saves'}
              onClick={() => onViewChange('auto-saves')}
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
          </div>
        )}
      </div>

      {/* ── NATIVE BOOKMARKS ── */}
      <div className="border-t border-white/10 mt-auto shrink-0">
        <SectionLabel label="Native Bookmarks" />
        <div className="px-2 pb-2">
          <button
            onClick={() => setShowNative((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 w-full text-sm hover:bg-white/10 rounded-lg transition-colors"
            style={{ color: 'var(--newtab-text-secondary)' }}
          >
            <Bookmark size={13} className="shrink-0 opacity-60" />
            <span className="flex-1 text-left">Chrome Bookmarks</span>
            <ChevronDown
              size={11}
              className={`transition-transform ${showNative ? '' : '-rotate-90'}`}
              style={{ opacity: 0.5 }}
            />
          </button>
          {showNative && (
            <div className="px-1 pt-1 pb-1 max-h-56 overflow-y-auto">
              <NativeBookmarkTree nodes={nativeTree} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
