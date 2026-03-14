import Modal from '@shared/components/Modal';

const SHORTCUTS = [
  { keys: '/ or Ctrl+K', description: 'Focus search' },
  { keys: 'Ctrl+Shift+L', description: 'Cycle layout (Minimal→Focus→Dashboard)' },
  { keys: 'Ctrl+Shift+D', description: 'Toggle density (Compact↔Comfortable)' },
  { keys: 'Ctrl+T', description: 'Focus to-do input' },
  { keys: 'Ctrl+N', description: 'Add bookmark' },
  { keys: 'Ctrl+Shift+N', description: 'New category' },
  { keys: 'Ctrl+1–9', description: 'Switch board' },
  { keys: 'Ctrl+B', description: 'Toggle sidebar' },
  { keys: 'Ctrl+,', description: 'Open settings' },
  { keys: 'Ctrl+Shift+T', description: 'Toggle theme' },
  { keys: 'Ctrl+Shift+W', description: 'Open wallpaper picker' },
  { keys: 'Escape', description: 'Close modal' },
  { keys: '?', description: 'Show this help' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardHelpModal({ isOpen, onClose }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {SHORTCUTS.map(({ keys, description }) => (
          <div key={keys} className="contents">
            <kbd className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono whitespace-nowrap justify-self-start self-center">
              {keys}
            </kbd>
            <span className="text-sm self-center">{description}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
