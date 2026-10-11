import { useEffect, useState } from 'react';
import { getBrowserInstance, type BrowserInstance } from '@core/services/browser-instance.service';

/** This browser's identity (null until loaded). */
export function useBrowserInstance(): BrowserInstance | null {
  const [instance, setInstance] = useState<BrowserInstance | null>(null);
  useEffect(() => {
    let active = true;
    void getBrowserInstance().then((i) => {
      if (active) setInstance(i);
    });
    return () => {
      active = false;
    };
  }, []);
  return instance;
}
