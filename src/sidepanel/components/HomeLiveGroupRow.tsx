import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MoreVertical, Edit2, Check, X, ChevronDown, ChevronRight, Monitor, XCircle, Trash2, Bookmark, BookmarkCheck } from 'lucide-react';
import type { ToastData } from '@shared/components/Toast';
import ContextMenu from '@shared/components/ContextMenu';
import type { ChromeGroupColor } from '@core/types/session.types';
import { GROUP_COLORS } from '@core/constants/tab-group-colors';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';

export interface TGLiveGroup {
  id: number;
  title: string;
  color: ChromeGroupColor;
  collapsed: boolean;
  windowId: number;
  tabs: chrome.tabs.Tab[];
}

interface HomeLiveGroupRowProps {
  group: TGLiveGroup;
  onRefresh: () => Promise<void>;
  onToast: (toast: Omit<ToastData, 'id'>) => void;
}

export default function HomeLiveGroupRow({ group, onRefresh, onToast }: HomeLiveGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(group.title);
  const [busy, setBusy] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accentColor = GROUP_COLORS[group.color] ?? '#9aa0a6';
  const templateKey = `${group.title}-${group.color}`;

  useEffect(() => {
    TabGroupTemplateStorage.getAll().then((all) => {
      setBookmarked(all.some((t) => t.key === templateKey));
    });
  }, [templateKey]);

  const startEdit = useCallback(() => {
    setDraftTitle(group.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [group.title]);

  const saveEdit = useCallback(async () => {
    setBusy(true);
    try {
      await chrome.tabGroups.update(group.id, { title: draftTitle.trim() || group.title });
      setEditing(false);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }, [group.id, group.title, draftTitle, onRefresh]);

  const handleClose = useCallback(async () => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await TabGroupTemplateStorage.upsert({
        key: `${group.title}-${group.color}`,
        title: group.title,
        color: group.color,
        tabs: group.tabs.map((t) => ({ url: t.url ?? '', title: t.title ?? '', favIconUrl: t.favIconUrl ?? '' })),
        savedAt: now,
        updatedAt: now,
      });
      const tabIds = group.tabs.map((t) => t.id!).filter(Boolean);
      if (tabIds.length > 0) await chrome.tabs.remove(tabIds);
      await onRefresh();
      onToast({ message: 'Group closed and saved', type: 'success' });
    } finally {
      setBusy(false);
    }
  }, [group, onRefresh, onToast]);

  const handleFocus = useCallback(async () => {
    const firstTab = group.tabs[0];
    if (firstTab?.id) {
      await chrome.windows.update(group.windowId, { focused: true });
      await chrome.tabs.update(firstTab.id, { active: true });
    }
  }, [group.tabs, group.windowId]);

  const handleUngroup = useCallback(async () => {
    const tabIds = group.tabs.map((t) => t.id!).filter(Boolean);
    if (tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
      await onRefresh();
    }
  }, [group.tabs, onRefresh]);

  const handleSaveAsTemplate = useCallback(async () => {
    setBookmarking(true);
    try {
      const now = new Date().toISOString();
      await TabGroupTemplateStorage.upsert({
        key: templateKey,
        title: group.title,
        color: group.color,
        tabs: group.tabs.map((t) => ({ url: t.url ?? '', title: t.title ?? '', favIconUrl: t.favIconUrl ?? '' })),
        savedAt: now,
        updatedAt: now,
      });
      setBookmarked(true);
      onToast({ message: 'Tab group saved', type: 'success' });
      await onRefresh();
    } finally {
      setBookmarking(false);
    }
  }, [group, templateKey, onRefresh, onToast]);

  const menuItems = useMemo(() => [
    { label: 'Rename',             icon: Edit2,    onClick: startEdit },
    { label: 'Restore Here',       icon: Monitor,  onClick: () => void handleFocus() },
    { label: 'Close from browser', icon: XCircle,  onClick: () => void handleClose() },
    { label: 'Ungroup',            icon: Trash2,   onClick: () => void handleUngroup(), danger: true },
  ], [startEdit, handleFocus, handleClose, handleUngroup]);

  return (
    <div className="border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-secondary)] transition-colors group">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        {editing ? (
          <>
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="flex-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text)] outline-none focus:border-blue-500"
            />
            <button onClick={() => void saveEdit()} disabled={busy} className="p-1 rounded text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
              <Check size={12} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-[var(--color-bg-secondary)]" style={{ color: 'var(--color-text-secondary)' }}>
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center gap-1 text-left min-w-0"
            >
              <span className="font-medium text-sm truncate">{group.title || 'Unnamed group'}</span>
              {expanded
                ? <ChevronDown size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
            </button>
            <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {group.tabs.length}t
            </span>
            {(busy || bookmarking) ? (
              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-secondary)' }} />
              </span>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); void handleSaveAsTemplate(); }}
                  title={bookmarked ? 'Saved — syncs across devices' : 'Save as template'}
                  className="p-0.5 rounded transition-colors shrink-0"
                  style={{ color: bookmarked ? '#34c759' : 'var(--color-text-secondary)' }}
                >
                  {bookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                </button>
                <ContextMenu items={menuItems}>
                  <button
                    className="p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors shrink-0"
                    style={{ color: 'var(--color-text-secondary)' }}
                    aria-label="More actions"
                  >
                    <MoreVertical size={13} />
                  </button>
                </ContextMenu>
              </>
            )}
          </>
        )}
      </div>
      {expanded && !editing && (
        <div className="border-t border-[var(--color-border)] max-h-36 overflow-auto" style={{ background: 'var(--color-bg-secondary)', opacity: 0.9 }}>
          {group.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id && void chrome.tabs.update(tab.id, { active: true })}
              className="w-full flex items-center gap-2 px-5 py-1.5 hover:bg-[var(--color-bg-hover)] text-left transition-colors"
            >
              {tab.favIconUrl
                ? <img src={tab.favIconUrl} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" />
                : <div className="w-3.5 h-3.5 rounded-sm bg-white/10 shrink-0" />}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                {tab.title || tab.url || 'New Tab'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
