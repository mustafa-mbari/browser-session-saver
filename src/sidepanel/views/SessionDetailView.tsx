import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trash2, Download, ExternalLink, Edit2, Check, X, PenLine } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import type { ExportFormat, RestoreMode } from '@core/types/messages.types';
import { formatTimestamp } from '@core/utils/date';
import { generateId } from '@core/utils/uuid';
import { useSidePanelStore } from '../stores/sidepanel.store';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import Modal from '@shared/components/Modal';
import Toast, { type ToastData } from '@shared/components/Toast';
import TabGroupPreview from '../components/TabGroupPreview';

const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'csv', label: 'CSV' },
  { value: 'text', label: 'Text' },
];

const MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  html: 'text/html',
  markdown: 'text/markdown',
  csv: 'text/csv',
  text: 'text/plain',
};

export default function SessionDetailView() {
  const { selectedSessionId, goBack } = useSidePanelStore();
  const { restoreSession, deleteSession, updateSession } = useSession();
  const { sendMessage } = useMessaging();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Tab edit mode
  const [editMode, setEditMode] = useState(false);

  // Tags
  const [newTag, setNewTag] = useState('');

  // Notes
  const [notesValue, setNotesValue] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  // Selective restore modal
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<string>>(new Set());
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('new_window');

  useEffect(() => {
    if (!selectedSessionId) return;

    const fetchSession = async () => {
      setLoading(true);
      const response = await sendMessage<Session[]>({
        action: 'GET_SESSIONS',
        payload: {},
      });
      if (response.success && response.data) {
        const found = response.data.find((s) => s.id === selectedSessionId);
        setSession(found ?? null);
        if (found) {
          setNameInput(found.name);
          setNotesValue(found.notes ?? '');
        }
      }
      setLoading(false);
    };

    fetchSession();
  }, [selectedSessionId, sendMessage]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: generateId() }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!session) return <div className="p-4 text-center text-[var(--color-text-secondary)]">Session not found</div>;

  const handleSaveName = async () => {
    if (nameInput.trim() && nameInput !== session.name) {
      await updateSession(session.id, { name: nameInput.trim() });
      setSession({ ...session, name: nameInput.trim() });
    }
    setEditingName(false);
  };

  const handleExport = async (format: ExportFormat) => {
    setShowExportMenu(false);
    const response = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: [session.id], format },
    });
    if (response.success && response.data) {
      const blob = new Blob([response.data], { type: MIME_TYPES[format] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.name.replace(/[^a-zA-Z0-9]/g, '_')}.${format === 'markdown' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDelete = async () => {
    const sessionSnapshot = { ...session };
    const result = await deleteSession(session.id);
    if (result.success) {
      let undone = false;
      const toastId = generateId();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          message: 'Session deleted',
          type: 'success' as const,
          duration: 10000,
          action: {
            label: 'Undo',
            onClick: async () => {
              undone = true;
              await sendMessage({ action: 'UNDELETE_SESSION', payload: { session: sessionSnapshot } });
              window.dispatchEvent(new CustomEvent('session-changed'));
              setToasts((prev) => prev.filter((t) => t.id !== toastId));
              setSession(sessionSnapshot);
            },
          },
        },
      ]);
      setTimeout(() => {
        if (!undone) goBack();
      }, 10200);
    }
  };

  const handleOpenRestoreModal = () => {
    setSelectedTabIds(new Set(session.tabs.map((t) => t.id)));
    setRestoreMode('new_window');
    setShowRestoreModal(true);
  };

  const handleConfirmRestore = async () => {
    const allSelected = selectedTabIds.size === session.tabs.length;
    let result;
    if (allSelected) {
      result = await restoreSession(session.id, restoreMode);
    } else {
      result = await sendMessage({
        action: 'RESTORE_SELECTED_TABS',
        payload: { sessionId: session.id, tabIds: Array.from(selectedTabIds), mode: restoreMode },
      });
    }
    setShowRestoreModal(false);
    if (result.success) {
      const failedUrls = (result.data as { failedUrls?: string[] } | undefined)?.failedUrls;
      if (failedUrls && failedUrls.length > 0) {
        addToast({ message: `${failedUrls.length} tab(s) failed to open`, type: 'warning', duration: 8000 });
      } else {
        addToast({ message: 'Session restored', type: 'success' });
      }
    } else {
      addToast({ message: result.error ?? 'Failed to restore', type: 'error' });
    }
  };

  const handleAddTag = async () => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || session.tags.includes(tag)) {
      setNewTag('');
      return;
    }
    const updated = [...session.tags, tag];
    await updateSession(session.id, { tags: updated });
    setSession({ ...session, tags: updated });
    setNewTag('');
  };

  const handleRemoveTag = async (tag: string) => {
    const updated = session.tags.filter((t) => t !== tag);
    await updateSession(session.id, { tags: updated });
    setSession({ ...session, tags: updated });
  };

  const handleSaveNotes = async () => {
    if (!notesDirty) return;
    await updateSession(session.id, { notes: notesValue });
    setSession({ ...session, notes: notesValue });
    setNotesDirty(false);
  };

  const handleRemoveTab = async (tabId: string) => {
    const updatedTabs = session.tabs.filter((t) => t.id !== tabId);
    const usedGroupIds = new Set(updatedTabs.map((t) => t.groupId));
    const updatedGroups = session.tabGroups.filter((g) => usedGroupIds.has(g.id));
    const updates = { tabs: updatedTabs, tabGroups: updatedGroups, tabCount: updatedTabs.length };
    await updateSession(session.id, updates);
    setSession({ ...session, ...updates });
  };

  const toggleTabSelection = (tabId: string) => {
    setSelectedTabIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  };

  const groupedTabs = session.tabGroups.map((group) => ({
    group,
    tabs: session.tabs.filter((t) => t.groupId === group.id),
  }));
  const ungroupedTabs = session.tabs.filter((t) => t.groupId === -1);

  return (
    <div className="flex flex-col h-full">
      {/* Session Header */}
      <div className="px-3 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {editingName ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
              />
              <button onClick={handleSaveName} className="p-1 text-success">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-sm flex-1 truncate">{session.name}</h2>
              <button
                onClick={() => setEditingName(true)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Edit name"
              >
                <Edit2 size={14} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {formatTimestamp(session.createdAt)}
          </span>
          <Badge>{session.tabCount} tabs</Badge>
          {session.isAutoSave && <Badge variant="primary">Auto</Badge>}
        </div>
        {session.tabGroups.length > 0 && (
          <div className="mt-1.5">
            <TabGroupPreview groups={session.tabGroups} maxVisible={10} />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-3 py-2 flex gap-2 border-b border-[var(--color-border)]">
        <Button icon={RotateCcw} size="sm" className="flex-1" onClick={handleOpenRestoreModal}>
          Restore
        </Button>
        <div className="relative">
          <Button icon={Download} variant="secondary" size="sm" onClick={() => setShowExportMenu((v) => !v)}>
            Export
          </Button>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-1 z-20 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-card shadow-card min-w-[100px]">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => handleExport(fmt.value)}
                  className="block w-full px-3 py-1.5 text-xs text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          icon={PenLine}
          variant={editMode ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setEditMode((v) => !v)}
          aria-label="Toggle tab edit mode"
        >
          Edit
        </Button>
        <Button icon={Trash2} variant="danger" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      {/* Tags Section */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1 flex-wrap min-h-[24px]">
          {session.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-primary rounded-full"
            >
              #{tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-error ml-0.5"
                aria-label={`Remove tag ${tag}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
            }}
            onBlur={handleAddTag}
            placeholder="+ add tag"
            className="text-xs px-1 py-0.5 bg-transparent border-none focus:outline-none text-[var(--color-text-secondary)] w-16 min-w-0"
          />
        </div>
      </div>

      {/* Notes Section */}
      <div className="px-3 py-1.5 border-b border-[var(--color-border)]">
        <textarea
          value={notesValue}
          onChange={(e) => { setNotesValue(e.target.value); setNotesDirty(true); }}
          onBlur={handleSaveNotes}
          placeholder="Add notes..."
          rows={2}
          className="w-full text-xs bg-transparent border-none resize-none focus:outline-none text-[var(--color-text-secondary)] placeholder-[var(--color-text-secondary)]"
        />
      </div>

      {/* Tab List */}
      <div className="flex-1 overflow-auto">
        {groupedTabs.map(({ group, tabs }) => (
          <div key={group.id}>
            <div className="px-3 py-1.5 bg-[var(--color-bg-secondary)] flex items-center gap-2 sticky top-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: `var(--group-${group.color})` }}
              />
              <span className="text-xs font-medium">{group.title || 'Unnamed group'}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{tabs.length}</span>
            </div>
            {tabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                editMode={editMode}
                onRemove={() => handleRemoveTab(tab.id)}
              />
            ))}
          </div>
        ))}

        {ungroupedTabs.length > 0 && (
          <>
            {groupedTabs.length > 0 && (
              <div className="px-3 py-1.5 bg-[var(--color-bg-secondary)] text-xs font-medium sticky top-0">
                Ungrouped
              </div>
            )}
            {ungroupedTabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                editMode={editMode}
                onRemove={() => handleRemoveTab(tab.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Selective Restore Modal */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title="Restore Session"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowRestoreModal(false)}>
              Cancel
            </Button>
            <Button size="sm" icon={RotateCcw} onClick={handleConfirmRestore} disabled={selectedTabIds.size === 0}>
              Restore {selectedTabIds.size} tab{selectedTabIds.size !== 1 ? 's' : ''}
            </Button>
          </>
        }
      >
        {/* Restore mode */}
        <div className="flex gap-3 mb-3">
          {(['new_window', 'current', 'append'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                name="restoreMode"
                value={mode}
                checked={restoreMode === mode}
                onChange={() => setRestoreMode(mode)}
                className="accent-primary"
              />
              {mode === 'new_window' ? 'New Window' : mode === 'current' ? 'Replace' : 'Append'}
            </label>
          ))}
        </div>

        {/* Select all toggle */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {selectedTabIds.size} / {session.tabs.length} selected
          </span>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => {
              if (selectedTabIds.size === session.tabs.length) {
                setSelectedTabIds(new Set());
              } else {
                setSelectedTabIds(new Set(session.tabs.map((t) => t.id)));
              }
            }}
          >
            {selectedTabIds.size === session.tabs.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        {/* Tab list with checkboxes */}
        <div className="max-h-60 overflow-auto space-y-0.5">
          {session.tabs.map((tab) => (
            <label
              key={tab.id}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--color-bg-secondary)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTabIds.has(tab.id)}
                onChange={() => toggleTabSelection(tab.id)}
                className="accent-primary shrink-0"
              />
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-600 shrink-0" />
              )}
              <span className="text-xs truncate">{tab.title || tab.url}</span>
            </label>
          ))}
        </div>
      </Modal>

      {/* Toast Container */}
      <div className="fixed bottom-4 left-2 right-2 z-50 space-y-2 pointer-events-none">
        <div className="pointer-events-auto space-y-2">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TabRow({
  tab,
  editMode,
  onRemove,
}: {
  tab: { id: string; url: string; title: string; favIconUrl: string };
  editMode?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--color-bg-secondary)] transition-colors group">
      {editMode && (
        <button
          onClick={onRemove}
          className="shrink-0 p-0.5 text-error opacity-70 hover:opacity-100"
          aria-label={`Remove tab ${tab.title}`}
        >
          <X size={12} />
        </button>
      )}
      {tab.favIconUrl ? (
        <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-600 shrink-0" />
      )}
      <span className="text-sm truncate flex-1" title={tab.title}>
        {tab.title || tab.url}
      </span>
      {!editMode && (
        <a
          href={tab.url}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
          aria-label={`Open ${tab.title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} className="text-[var(--color-text-secondary)]" />
        </a>
      )}
    </div>
  );
}
