import { Trash2, Download, X, GitMerge, GitCompare } from 'lucide-react';

interface SessionBulkToolbarProps {
  selectedIds: Set<string>;
  onClear: () => void;
  onDelete: (ids: string[]) => void;
  onExport: (ids: string[]) => void;
  onMerge: (ids: string[]) => void;
  onCompare: (ids: [string, string]) => void;
}

export default function SessionBulkToolbar({
  selectedIds,
  onClear,
  onDelete,
  onExport,
  onMerge,
  onCompare,
}: SessionBulkToolbarProps) {
  const count = selectedIds.size;
  if (count === 0) return null;

  const ids = Array.from(selectedIds);

  const btnBase =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-2xl"
      style={{
        background: 'rgba(18, 18, 40, 0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <span className="text-sm font-medium" style={{ color: 'var(--newtab-text)' }}>
        {count} selected
      </span>
      <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.12)' }} />

      <button
        onClick={() => onExport(ids)}
        className={btnBase}
        style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.08)' }}
        title="Export selected"
      >
        <Download size={13} /> Export
      </button>

      {count >= 2 && (
        <button
          onClick={() => onMerge(ids)}
          className={btnBase}
          style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.08)' }}
          title="Merge selected"
        >
          <GitMerge size={13} /> Merge
        </button>
      )}

      {count === 2 && (
        <button
          onClick={() => onCompare(ids as [string, string])}
          className={btnBase}
          style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.08)' }}
          title="Compare two sessions"
        >
          <GitCompare size={13} /> Compare
        </button>
      )}

      <button
        onClick={() => onDelete(ids)}
        className={btnBase}
        style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)' }}
        title="Delete selected"
      >
        <Trash2 size={13} /> Delete
      </button>

      <button
        onClick={onClear}
        className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.4)' }}
        aria-label="Clear selection"
      >
        <X size={14} />
      </button>
    </div>
  );
}
