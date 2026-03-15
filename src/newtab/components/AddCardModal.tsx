import { useState } from 'react';
import Modal from '@shared/components/Modal';
import Button from '@shared/components/Button';
import type { CardType } from '@core/types/newtab.types';

interface CardTypeOption {
  type: CardType;
  icon: string;
  label: string;
  description: string;
}

const CARD_TYPES: CardTypeOption[] = [
  {
    type: 'bookmark',
    icon: '🔖',
    label: 'Bookmark List',
    description: 'A collection of saved links with favicons',
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
];

interface Props {
  isOpen: boolean;
  boardId: string;
  onClose: () => void;
  onAdd: (boardId: string, type: CardType) => void;
}

export default function AddCardModal({ isOpen, boardId, onClose, onAdd }: Props) {
  const [selected, setSelected] = useState<CardType>('bookmark');

  const handleAdd = () => {
    onAdd(boardId, selected);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Card"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd}>Add Card</Button>
        </>
      }
    >
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
    </Modal>
  );
}
