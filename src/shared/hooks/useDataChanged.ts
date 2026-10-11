import { useEffect, useRef } from 'react';
import { onDataChanged, type DataModule } from '@core/events/data-change-bus';

interface Options {
  /**
   * Skip edits announced by this page itself — for views that already show
   * their own edits (and may hold unsaved state a reload would drop).
   */
  ignoreOwnEdits?: boolean;
}

/** Call `onChange` whenever another page, the service worker, a sync or this page changes `modules`. */
export function useDataChanged(
  modules: readonly DataModule[],
  onChange: () => void,
  options: Options = {},
): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const key = modules.join(',');
  const ignoreOwnEdits = options.ignoreOwnEdits ?? false;
  useEffect(() => {
    const wanted = key.split(',') as DataModule[];
    return onDataChanged((changed, info) => {
      if (ignoreOwnEdits && info.local && !info.fromSync) return;
      if (wanted.some((m) => changed.has(m))) onChangeRef.current();
    });
  }, [key, ignoreOwnEdits]);
}
