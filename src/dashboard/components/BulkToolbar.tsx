import { Trash2, Download, X, Tag } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboard.store';
import Button from '@shared/components/Button';

interface BulkToolbarProps {
  onDelete: (ids: string[]) => void;
  onExport: (ids: string[]) => void;
}

export default function BulkToolbar({ onDelete, onExport }: BulkToolbarProps) {
  const { selectedSessionIds, clearSelection } = useDashboardStore();
  const count = selectedSessionIds.size;

  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-modal bg-[var(--color-bg)] shadow-xl border border-[var(--color-border)]">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="w-px h-5 bg-[var(--color-border)]" />
      <Button
        icon={Download}
        variant="secondary"
        size="sm"
        onClick={() => onExport(Array.from(selectedSessionIds))}
      >
        Export
      </Button>
      <Button
        icon={Trash2}
        variant="danger"
        size="sm"
        onClick={() => onDelete(Array.from(selectedSessionIds))}
      >
        Delete
      </Button>
      <button
        onClick={clearSelection}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  );
}
