import { useEffect, useRef } from 'react';
import { onDataChanged, type DataModule } from '@core/events/data-change-bus';

/** Call `onChange` whenever another page, the service worker or this page changes `modules`. */
export function useDataChanged(modules: readonly DataModule[], onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const key = modules.join(',');
  useEffect(() => {
    const wanted = key.split(',') as DataModule[];
    return onDataChanged((changed) => {
      if (wanted.some((m) => changed.has(m))) onChangeRef.current();
    });
  }, [key]);
}
