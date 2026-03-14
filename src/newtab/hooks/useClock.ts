import { useEffect, useRef, useState } from 'react';
import type { ClockFormat } from '@core/types/newtab.types';

function formatTime(date: Date, format: ClockFormat): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: format === '12h',
  }).format(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function useClock(clockFormat: ClockFormat): { timeString: string; dateString: string } {
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    timeString: formatTime(now, clockFormat),
    dateString: formatDate(now),
  };
}
