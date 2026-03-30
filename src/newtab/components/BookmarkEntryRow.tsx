import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import ContextMenu from '@shared/components/ContextMenu';
import type { BookmarkEntry, CardDensity } from '@core/types/newtab.types';
import { resolveFavIcon, getFaviconFallbackUrl, getFaviconInitial, getChromeInternalFaviconUrl } from '@core/utils/favicon';
import { safeOpenUrl } from '@core/utils/safe-open';

export interface BookmarkEntryRowProps {
  entry: BookmarkEntry;
  density: CardDensity;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string, url: string) => void;
}

export default function BookmarkEntryRow({ entry, density, onDelete, onRename }: BookmarkEntryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });
  const [favTryIdx, setFavTryIdx] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(entry.title || entry.url);
  const [draftUrl, setDraftUrl] = useState(entry.url);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const rowH = density === 'compact' ? 'py-1' : 'py-1.5';
  const iconCls = density === 'compact' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs';
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm';

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraft(entry.title || entry.url);
    setDraftUrl(entry.url);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitRename = () => {
    const title = draft.trim() || entry.title || entry.url;
    const url = draftUrl.trim() || entry.url;
    onRename(entry.id, title, url);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setDraft(entry.title || entry.url);
    setDraftUrl(entry.url);
    setIsRenaming(false);
  };

  const menuItems = [
    { label: 'Open in new tab', onClick: () => safeOpenUrl(entry.url, '_blank') },
    { label: 'Edit', icon: Pencil, onClick: () => { setDraft(entry.title || entry.url); setDraftUrl(entry.url); setIsRenaming(true); setTimeout(() => inputRef.current?.focus(), 0); } },
    { label: 'Delete', icon: Trash2, onClick: () => onDelete(entry.id), danger: true },
  ];

  const favSources = [resolveFavIcon(entry.favIconUrl, entry.url), getChromeInternalFaviconUrl(entry.url), getFaviconFallbackUrl(entry.url)].filter(Boolean);
  const favSrc = favSources[favTryIdx] ?? '';
  const favicon = favSrc ? (
    <img src={favSrc} alt="" className={`${iconCls} rounded shrink-0`} onError={() => setFavTryIdx((i) => i + 1)} />
  ) : (
    <span className={`${iconCls} flex items-center justify-center rounded bg-white/20 font-bold shrink-0`} style={{ color: 'var(--newtab-text)' }}>
      {getFaviconInitial(entry.title, entry.url)}
    </span>
  );

  const itemStyle = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={itemStyle} className="flex flex-col gap-1 px-2 py-1.5 rounded bg-white/5" {...attributes}>
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { urlInputRef.current?.focus(); urlInputRef.current?.select(); }
            if (e.key === 'Escape') cancelRename();
            e.stopPropagation();
          }}
          placeholder="Title"
          className="w-full bg-white/10 rounded px-1.5 py-0.5 text-xs outline-none placeholder-white/30"
          style={{ color: 'var(--newtab-text)' }}
        />
        <input
          ref={urlInputRef}
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') cancelRename();
            e.stopPropagation();
          }}
          placeholder="URL"
          className="w-full bg-white/10 rounded px-1.5 py-0.5 text-xs outline-none placeholder-white/30"
          style={{ color: 'var(--newtab-text)' }}
        />
      </div>
    );
  }

  return (
    <ContextMenu items={menuItems}>
      <div
        ref={setNodeRef}
        style={itemStyle}
        {...attributes}
        className={`flex items-center gap-2 ${rowH} px-1 rounded hover:bg-white/10 cursor-pointer group`}
        onClick={() => safeOpenUrl(entry.url, '_self')}
      >
        <div
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0 p-0.5 rounded hover:bg-white/10"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical size={11} style={{ color: 'var(--newtab-text-secondary)' }} />
        </div>
        {favicon}
        <span className={`flex-1 truncate ${textSize}`} style={{ color: 'var(--newtab-text)' }}>
          {entry.title || entry.url}
        </span>
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={startRename}
            className="p-0.5 rounded hover:bg-white/20 transition-colors"
            aria-label="Edit bookmark"
            tabIndex={-1}
          >
            <Pencil size={11} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
            className="p-0.5 rounded hover:bg-red-500/30 transition-colors"
            aria-label="Delete bookmark"
            tabIndex={-1}
          >
            <Trash2 size={11} style={{ color: 'rgba(248,113,113,0.8)' }} />
          </button>
        </div>
      </div>
    </ContextMenu>
  );
}
