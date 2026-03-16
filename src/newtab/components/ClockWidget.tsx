import { useClock } from '@newtab/hooks/useClock';
import type { ClockFormat, SpanValue } from '@core/types/newtab.types';

interface Props {
  clockFormat: ClockFormat;
  colSpan?: SpanValue;
  rowSpan?: SpanValue;
}

export default function ClockWidget({ clockFormat, colSpan = 3 }: Props) {
  const { timeString, dateString } = useClock(clockFormat);

  const timeClass =
    colSpan >= 4 ? 'text-7xl' :
    colSpan >= 3 ? 'text-5xl' :
    'text-3xl';

  const dateClass =
    colSpan >= 4 ? 'text-xl mt-2' :
    colSpan >= 3 ? 'text-base mt-1' :
    'text-xs mt-1';

  return (
    <div className="text-center select-none">
      <div
        className={`${timeClass} font-light tracking-tight`}
        style={{ color: 'var(--newtab-text)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
      >
        {timeString}
      </div>
      <div
        className={dateClass}
        style={{ color: 'var(--newtab-text-secondary)', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}
      >
        {dateString}
      </div>
    </div>
  );
}
