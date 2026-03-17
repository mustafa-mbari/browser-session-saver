import { useClock } from '@newtab/hooks/useClock';
import type { ClockFormat, SpanValue } from '@core/types/newtab.types';

interface Props {
  clockFormat: ClockFormat;
  colSpan?: SpanValue;
  rowSpan?: SpanValue;
}

export default function ClockWidget({ clockFormat, colSpan = 3, rowSpan = 3 }: Props) {
  const { timeString, dateString } = useClock(clockFormat);

  // Scale by colSpan (width-primary: time is a horizontal string)
  // but also cap at rowSpan so it doesn't overflow a short widget
  const size = Math.min(colSpan, rowSpan + 1); // rowSpan bias so 2w×3h reads as size=2

  const timeClass =
    size >= 6 ? 'text-9xl' :
    size >= 4 ? 'text-8xl' :
    size >= 3 ? 'text-7xl' :
    size >= 2 ? 'text-6xl' :
    'text-4xl';

  const dateClass =
    size >= 6 ? 'text-2xl mt-3' :
    size >= 4 ? 'text-xl mt-2' :
    size >= 3 ? 'text-lg mt-1.5' :
    size >= 2 ? 'text-sm mt-1' :
    'text-xs mt-1';

  return (
    <div className="text-center select-none w-full h-full flex flex-col items-center justify-center">
      <div
        className={`${timeClass} font-light tracking-tight leading-none`}
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
