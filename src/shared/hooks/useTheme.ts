import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '@core/types/settings.types';
import { useMessaging } from './useMessaging';

type ThemePreference = 'light' | 'dark' | 'system';

export function useTheme() {
  const { sendMessage } = useMessaging();
  const [theme, setThemeState] = useState<ThemePreference>('system');

  const isDark = useDarkMode(theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const setTheme = useCallback(
    async (newTheme: ThemePreference) => {
      setThemeState(newTheme);
      await sendMessage<Settings>({
        action: 'UPDATE_SETTINGS',
        payload: { theme: newTheme },
      });
    },
    [sendMessage],
  );

  return { theme, setTheme, isDark };
}

function useDarkMode(theme: ThemePreference): boolean {
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return systemDark;
}
