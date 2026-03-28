import { useState, useEffect, useRef } from 'react';
import { Save, FolderPlus, PenLine } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useBookmarkFolderData } from '@shared/hooks/useBookmarkFolderData';
import { useSidePanelStore } from '../stores/sidepanel.store';
import type { SaveSessionResponse } from '@core/types/messages.types';
import type { ToastData } from '@shared/components/Toast';

interface QuickActionsProps {
  onToast?: (toast: Omit<ToastData, 'id'>) => void;
}

export default function QuickActions({ onToast }: QuickActionsProps) {
  const { saveSession } = useSession();
  const { categories, saveCurrentTab } = useBookmarkFolderData();
  const { openPageFromMenu } = useSidePanelStore();

  // Only show bookmark-type folders in the picker (not widget categories)
  const folders = categories.filter((c) => (c.cardType === 'bookmark' || !c.cardType));
  const [saving, setSaving] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close folder picker on outside click
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
    if (folders.length === 0) {
      onToast?.({ message: 'Create a folder first', type: 'warning' });
      openPageFromMenu('folders');
      return;
    }
    setShowFolderPicker(!showFolderPicker);
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

  const handleCreatePrompt = () => {
    openPageFromMenu('prompts');
  };

  return (
    <div className="relative px-3 py-2 border-t border-[var(--color-border)]">
      {/* Folder picker dropdown */}
      {showFolderPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg max-h-48 overflow-y-auto z-50"
        >
          <div className="p-1">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => void handleSaveToFolder(folder.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs hover:bg-[var(--color-bg-hover)] transition-colors text-left"
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: folder.color || '#6366f1' }} />
                <span className="truncate" style={{ color: 'var(--color-text)' }}>{folder.name}</span>
              </button>
            ))}
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
          <span>Save</span>
        </button>

        <button
          onClick={handleFolderClick}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          style={{ color: 'var(--color-text)' }}
        >
          <FolderPlus size={14} />
          <span>Folder</span>
        </button>

        <button
          onClick={handleCreatePrompt}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          style={{ color: 'var(--color-text)' }}
        >
          <PenLine size={14} />
          <span>Prompt</span>
        </button>
      </div>
    </div>
  );
}
