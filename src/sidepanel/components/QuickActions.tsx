import { useState, useEffect, useRef } from 'react';
import { Save, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useBookmarkFolderData } from '@shared/hooks/useBookmarkFolderData';
import type { SaveSessionResponse } from '@core/types/messages.types';
import type { ToastData } from '@shared/components/Toast';
import type { BookmarkCategory } from '@core/types/newtab.types';

interface QuickActionsProps {
  onToast?: (toast: Omit<ToastData, 'id'>) => void;
}

// ── Folder tree helpers ────────────────────────────────────────────────────────

interface FolderNode {
  category: BookmarkCategory;
  children: FolderNode[];
}

function buildTree(cats: BookmarkCategory[]): FolderNode[] {
  function getChildren(parentId: string): FolderNode[] {
    return cats
      .filter((c) => c.parentCategoryId === parentId)
      .map((c) => ({ category: c, children: getChildren(c.id) }));
  }
  return cats
    .filter((c) => !c.parentCategoryId)
    .map((c) => ({ category: c, children: getChildren(c.id) }));
}

function FolderPickerNode({ node, depth, onSave }: {
  node: FolderNode;
  depth: number;
  onSave: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: `${depth * 10}px` }}>
        {hasChildren ? (
          <button
            className="p-0.5 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text)' }}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          onClick={() => onSave(node.category.id)}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-[var(--color-bg-hover)] transition-colors text-left"
          style={{ color: 'var(--color-text)' }}
        >
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: node.category.color || '#6366f1' }} />
          <span className="truncate">{node.category.name}</span>
        </button>
      </div>
      {expanded && node.children.map((child) => (
        <FolderPickerNode key={child.category.id} node={child} depth={depth + 1} onSave={onSave} />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function QuickActions({ onToast }: QuickActionsProps) {
  const { saveSession } = useSession();
  const { categories, saveCurrentTab, reload } = useBookmarkFolderData();

  const folders = categories.filter((c) => c.cardType === 'bookmark' || !c.cardType);
  const folderTree = buildTree(folders);

  const [saving, setSaving] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showFolderPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowFolderPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFolderPicker]);

  // Reload from IndexedDB every time the picker opens so newly created folders appear immediately
  useEffect(() => {
    if (showFolderPicker) void reload();
  }, [showFolderPicker, reload]);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveSession({ closeAfter: false });
    setSaving(false);
    if (result.success) {
      const responseData = result.data as SaveSessionResponse | undefined;
      if (responseData?.isDuplicate) {
        onToast?.({ message: 'Session looks identical to a recent save', type: 'warning' });
      } else {
        onToast?.({ message: 'Session saved successfully', type: 'success' });
      }
    } else {
      onToast?.({ message: result.error ?? 'Failed to save session', type: 'error' });
    }
  };

  const handleFolderClick = () => {
    setShowFolderPicker((v) => !v);
  };

  const handleSaveToFolder = async (folderId: string) => {
    setShowFolderPicker(false);
    const entry = await saveCurrentTab(folderId);
    if (entry) {
      onToast?.({ message: 'Tab saved to folder', type: 'success' });
    } else {
      onToast?.({ message: 'Failed to save tab', type: 'error' });
    }
  };

  return (
    <div className="relative px-3 py-2 border-t border-[var(--color-border)]">
      {/* Hierarchical folder picker */}
      {showFolderPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg max-h-56 overflow-y-auto z-50"
        >
          <div className="p-1">
            {folderTree.length === 0 ? (
              <p
                className="px-3 py-2 text-xs opacity-50 text-center"
                style={{ color: 'var(--color-text)' }}
              >
                No folders yet — create one in the Folders tab
              </p>
            ) : (
              folderTree.map((node) => (
                <FolderPickerNode
                  key={node.category.id}
                  node={node}
                  depth={0}
                  onSave={(id) => void handleSaveToFolder(id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          <span>Save Session</span>
        </button>

        <button
          onClick={handleFolderClick}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          style={{ color: 'var(--color-text)' }}
        >
          <FolderPlus size={14} />
          <span>Save in Folder</span>
        </button>
      </div>
    </div>
  );
}
