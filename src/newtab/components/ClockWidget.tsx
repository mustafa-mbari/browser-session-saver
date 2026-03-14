import { useClock } from '@newtab/hooks/useClock';
import type { ClockFormat } from '@core/types/newtab.types';

interface Props {
  clockFormat: ClockFormat;
}

export default function ClockWidget({ clockFormat }: Props) {
  const { timeString, dateString } = useClock(clockFormat);

  return (
    <div className="text-center select-none">
      <div
        className="text-7xl font-light tracking-tight"
        style={{ color: 'var(--newtab-text)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
      >
        {timeString}
      </div>
      <div
        className="text-xl mt-2"
        style={{ color: 'var(--newtab-text-secondary)', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}
      >
        {dateString}
      </div>
    </div>
  );
}
