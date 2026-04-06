import { Cloud, CloudDownload, Loader2 } from 'lucide-react';
import type { Board } from '@core/types/newtab.types';

interface DashboardConfig {
  version: 1;
  boards: Board[];
}

function parseDashboardConfig(json: string): DashboardConfig | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Record<string, unknown>).version !== 1 ||
      !Array.isArray((parsed as Record<string, unknown>).boards)
    ) {
      return null;
    }
    return parsed as DashboardConfig;
  } catch {
    return null;
  }
}

interface Props {
  configJson: string;
  onApply: (boards: Board[]) => Promise<void>;
  onDismiss: () => void;
  isApplying: boolean;
}

export default function DashboardRestoreModal({ configJson, onApply, onDismiss, isApplying }: Props) {
  const config = parseDashboardConfig(configJson);

  // Malformed config — auto-dismiss silently.
  // The background handler validates before storing, so this is a last-resort guard.
  if (!config) {
    onDismiss();
    return null;
  }

  const { boards } = config;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div className="glass-panel rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <Cloud size={20} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
              Apply Cloud Dashboard?
            </p>
            <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
              {boards.length} board{boards.length !== 1 ? 's' : ''} found in your cloud backup
            </p>
          </div>
        </div>

        {/* Board list preview */}
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {boards.map((board) => (
            <div
              key={board.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--newtab-text)' }}
            >
              <span>{board.icon}</span>
              <span className="truncate">{board.name}</span>
              <span
                className="ml-auto text-xs shrink-0"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                {board.categoryIds.length} card{board.categoryIds.length !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-[11px]" style={{ color: 'var(--newtab-text-secondary)' }}>
          Boards already on this device are kept. Only boards not yet present will be added.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onDismiss}
            disabled={isApplying}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-opacity disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--newtab-text-secondary)',
            }}
          >
            Keep Local Layout
          </button>
          <button
            onClick={() => void onApply(boards)}
            disabled={isApplying}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50"
            style={{ background: 'rgba(99,102,241,0.8)', color: '#fff' }}
          >
            {isApplying ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            {isApplying ? 'Applying…' : 'Apply Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
