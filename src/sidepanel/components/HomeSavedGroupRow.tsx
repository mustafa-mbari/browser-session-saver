import { useState, useCallback, useMemo, useRef } from 'react';
import { MoreVertical, Edit2, Check, X, ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import ContextMenu from '@shared/components/ContextMenu';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import { GROUP_COLORS } from '@core/constants/tab-group-colors';

interface HomeSavedGroupRowProps {
  template: TabGroupTemplate;
  onRestore: (t: TabGroupTemplate) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onRename: (key: string, newTitle: string) => Promise<void>;
}

export default function HomeSavedGroupRow({ template, onRestore, onDelete, onRename }: HomeSavedGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(template.title);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accentColor = GROUP_COLORS[template.color] ?? '#9aa0a6';

  const startEdit = useCallback(() => {
    setDraftTitle(template.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [template.title]);

  const saveRename = useCallback(async () => {
    const newTitle = draftTitle.trim();
    if (!newTitle || newTitle === template.title) { setEditing(false); return; }
    setBusy(true);
    try {
      await onRename(template.key, newTitle);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }, [draftTitle, template.title, template.key, onRename]);

  const menuItems = useMemo(() => [
    {
      label: 'Restore',
      icon: RotateCcw,
      onClick: () => {
        setBusy(true);
        void onRestore(template).finally(() => setBusy(false));
      },
    },
    { label: 'Rename', icon: Edit2, onClick: startEdit },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => {
        setBusy(true);
        void onDelete(template.key).finally(() => setBusy(false));
      },
      danger: true,
    },
  ], [template, onRestore, onDelete, startEdit]);

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
                if (e.key === 'Enter') void saveRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="flex-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text)] outline-none focus:border-blue-500"
            />
            <button onClick={() => void saveRename()} disabled={busy} className="p-1 rounded text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
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
              <span className="font-medium text-sm truncate">{template.title || 'Unnamed group'}</span>
              {expanded
                ? <ChevronDown size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
            </button>
            <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {template.tabs.length}t
            </span>
            {busy ? (
              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-secondary)' }} />
              </span>
            ) : (
              <ContextMenu items={menuItems}>
                <button
                  className="p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors shrink-0"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label="More actions"
                >
                  <MoreVertical size={13} />
                </button>
              </ContextMenu>
            )}
          </>
        )}
      </div>
      {expanded && !editing && (
        <div className="border-t border-[var(--color-border)] max-h-36 overflow-auto" style={{ background: 'var(--color-bg-secondary)', opacity: 0.9 }}>
          {template.tabs.slice(0, 20).map((tab, i) => (
            <div key={i} className="flex items-center gap-2 px-5 py-1.5">
              {tab.favIconUrl
                ? <img src={tab.favIconUrl} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" />
                : <div className="w-3.5 h-3.5 rounded-sm bg-white/10 shrink-0" />}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                {tab.title || tab.url || 'Unknown'}
              </span>
            </div>
          ))}
          {template.tabs.length > 20 && (
            <p className="text-xs text-center py-1 opacity-40" style={{ color: 'var(--color-text-secondary)' }}>
              +{template.tabs.length - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
