import { useAutoSave } from '@shared/hooks/useAutoSave';
import Tooltip from '@shared/components/Tooltip';
import { formatRelative } from '@core/utils/date';

export default function AutoSaveBadge() {
  const { isActive, lastAutoSave } = useAutoSave();

  const tooltipText = isActive
    ? lastAutoSave
      ? `Auto-save active. Last: ${formatRelative(lastAutoSave)}`
      : 'Auto-save active'
    : 'Auto-save paused';

  return (
    <Tooltip content={tooltipText}>
      <div className="flex items-center gap-1.5" aria-label={tooltipText}>
        <span
          className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-warning'}`}
        />
        <span className="text-xs text-[var(--color-text-secondary)]">
          {isActive ? 'Auto' : 'Paused'}
        </span>
      </div>
    </Tooltip>
  );
}
