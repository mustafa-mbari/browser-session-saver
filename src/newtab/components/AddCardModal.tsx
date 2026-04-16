import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Modal from '@shared/components/Modal';
import Button from '@shared/components/Button';
import type { BookmarkCategory, CardType } from '@core/types/newtab.types';

interface CardTypeOption {
  type: CardType;
  icon: string;
  label: string;
  description: string;
}

const CARD_TYPES: CardTypeOption[] = [
  {
    type: 'bookmark',
    icon: '📁',
    label: 'Bookmark List / Folder',
    description: 'A collection of saved links organised in a folder',
  },
  {
    type: 'clock',
    icon: '🕐',
    label: 'Clock',
    description: 'Shows the current time and date',
  },
  {
    type: 'todo',
    icon: '✅',
    label: 'To-Do List',
    description: 'A checklist to track your tasks',
  },
  {
    type: 'note',
    icon: '📝',
    label: 'Note',
    description: 'A free-text notepad that auto-saves',
  },
  {
    type: 'subscription',
    icon: '💳',
    label: 'Subscriptions',
    description: 'Track recurring payments and renewals',
  },
  {
    type: 'tab-groups',
    icon: '🗂️',
    label: 'Tab Groups',
    description: 'View and manage your live browser tab groups',
  },
  {
    type: 'native-bookmarks',
    icon: '🔗',
    label: 'Chrome Bookmarks',
    description: 'Browse your Chrome bookmarks tree',
  },
  {
    type: 'weather',
    icon: '🌤️',
    label: 'Weather',
    description: "Today's and tomorrow's forecast for your location",
  },
  {
    type: 'downloads',
    icon: '⬇️',
    label: 'Recent Downloads',
    description: 'Shows the last 5 files downloaded in Chrome',
  },
  {
    type: 'prompt-manager',
    icon: '✨',
    label: 'Prompts',
    description: 'Pinned & recent AI prompts at a glance',
  },
];

type BookmarkSubOption = 'create-new' | 'link-existing';

// ─── Recursive folder picker row ─────────────────────────────────────────────

interface FolderPickerRowProps {
  folder: BookmarkCategory;
  allFolders: BookmarkCategory[];
  linkedFolderIds: string[];
  selectedFolderId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}

function FolderPickerRow({
  folder,
  allFolders,
  linkedFolderIds,
  selectedFolderId,
  onSelect,
  depth,
}: FolderPickerRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const childFolders = allFolders.filter((f) => f.parentCategoryId === folder.id);
  const isLinked = linkedFolderIds.includes(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = childFolders.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 border-b border-[var(--color-border)]"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {/* Expand / collapse toggle — invisible placeholder when no children */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="p-1 shrink-0 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          style={{ opacity: hasChildren ? 1 : 0, pointerEvents: hasChildren ? 'auto' : 'none' }}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded
            ? <ChevronDown size={12} className="text-[var(--color-text-secondary)]" />
            : <ChevronRight size={12} className="text-[var(--color-text-secondary)]" />
          }
        </button>

        {/* Folder selection row */}
        <button
          onClick={() => { if (!isLinked) onSelect(folder.id); }}
          disabled={isLinked}
          className={`flex flex-1 items-center gap-2 pr-3 py-2.5 text-left transition-colors min-w-0 ${
            isLinked
              ? 'opacity-40 cursor-not-allowed'
              : isSelected
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-[var(--color-bg-secondary)]'
          }`}
        >
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0"
            style={{ backgroundColor: `${folder.color}22` }}
          >
            {folder.icon}
          </span>
          <span className="text-sm text-[var(--color-text)] truncate flex-1">{folder.name}</span>
          {isLinked && (
            <span className="text-xs text-[var(--color-text-secondary)] shrink-0">On board</span>
          )}
          {isSelected && !isLinked && (
            <span className="text-blue-500 text-xs shrink-0">✓</span>
          )}
        </button>
      </div>

      {/* Children — only when expanded */}
      {isExpanded && childFolders.map((cf) => (
        <FolderPickerRow
          key={cf.id}
          folder={cf}
          allFolders={allFolders}
          linkedFolderIds={linkedFolderIds}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  boardId: string;
  onClose: () => void;
  onAdd: (boardId: string, type: CardType) => void;
  availableFolders?: BookmarkCategory[];
  linkedFolderIds?: string[];
  onLinkFolder?: (categoryId: string) => void;
}

export default function AddCardModal({
  isOpen,
  boardId,
  onClose,
  onAdd,
  availableFolders = [],
  linkedFolderIds = [],
  onLinkFolder,
}: Props) {
  const [selected, setSelected] = useState<CardType>('bookmark');
  const [step, setStep] = useState<'type-select' | 'bookmark-options'>('type-select');
  const [subOption, setSubOption] = useState<BookmarkSubOption>('create-new');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const handleClose = () => {
    setStep('type-select');
    setSelected('bookmark');
    setSubOption('create-new');
    setSelectedFolderId(null);
    onClose();
  };

  const handleAdd = () => {
    if (step === 'type-select') {
      if (selected === 'bookmark') {
        setStep('bookmark-options');
        setSubOption('create-new');
        setSelectedFolderId(null);
        return;
      }
      onAdd(boardId, selected);
      handleClose();
      return;
    }

    if (subOption === 'create-new') {
      onAdd(boardId, 'bookmark');
    } else if (subOption === 'link-existing' && selectedFolderId && onLinkFolder) {
      onLinkFolder(selectedFolderId);
    }
    handleClose();
  };

  const isAddDisabled =
    step === 'bookmark-options' &&
    subOption === 'link-existing' &&
    (!selectedFolderId || linkedFolderIds.includes(selectedFolderId));

  // Only top-level folders as roots (those whose parent isn't in the list)
  const folderIds = new Set(availableFolders.map((f) => f.id));
  const rootFolders = availableFolders.filter(
    (f) => !f.parentCategoryId || !folderIds.has(f.parentCategoryId),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      title={step === 'type-select' ? 'Add Widget' : 'Bookmark List / Folder'}
      actions={
        <>
          {step === 'bookmark-options' ? (
            <Button variant="secondary" onClick={() => setStep('type-select')}>Back</Button>
          ) : (
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          )}
          <Button variant="primary" onClick={handleAdd} disabled={isAddDisabled}>
            Add Widget
          </Button>
        </>
      }
    >
      {step === 'type-select' && (
        <div className="grid grid-cols-2 gap-2 py-1">
          {CARD_TYPES.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl text-center transition-all border ${
                selected === opt.type
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <span className="text-3xl leading-none">{opt.icon}</span>
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">{opt.label}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 'bookmark-options' && (
        <div className="py-1 flex flex-col gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Choose how to add this widget:
          </p>

          {/* Sub-option: Create New */}
          <button
            onClick={() => setSubOption('create-new')}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all border ${
              subOption === 'create-new'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            <span className="text-2xl leading-none mt-0.5">📁</span>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Create New Folder</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Start with a blank bookmark collection
              </p>
            </div>
          </button>

          {/* Sub-option: Link Existing */}
          <button
            onClick={() => {
              if (availableFolders.length > 0) {
                setSubOption('link-existing');
                setSelectedFolderId(null);
              }
            }}
            disabled={availableFolders.length === 0}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all border ${
              availableFolders.length === 0
                ? 'opacity-40 cursor-not-allowed border-[var(--color-border)]'
                : subOption === 'link-existing'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            <span className="text-2xl leading-none mt-0.5">📂</span>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Link Existing Folder</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {availableFolders.length === 0
                  ? 'No folders yet — create one in Folders → My Folders'
                  : 'Display an existing folder from the Folders page'}
              </p>
            </div>
          </button>

          {/* Collapsible folder tree — shown when Link Existing is selected */}
          {subOption === 'link-existing' && availableFolders.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)]">
              {rootFolders.length === 0 ? (
                <div className="px-4 py-3 text-xs text-center text-[var(--color-text-secondary)]">
                  All your folders are already on this board
                </div>
              ) : (
                rootFolders.map((folder) => (
                  <FolderPickerRow
                    key={folder.id}
                    folder={folder}
                    allFolders={availableFolders}
                    linkedFolderIds={linkedFolderIds}
                    selectedFolderId={selectedFolderId}
                    onSelect={setSelectedFolderId}
                    depth={0}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
