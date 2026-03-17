// Runtime locale cache — populated by loadLocale() on app start
let _locale: Record<string, { message: string }> = {};

/**
 * Load a locale's messages.json from the extension bundle.
 * Call once on app boot when settings.language !== 'auto'.
 */
export async function loadLocale(lang: string): Promise<void> {
  if (lang === 'auto') { _locale = {}; return; }
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    _locale = (await res.json()) as Record<string, { message: string }>;
  } catch {
    _locale = {};
  }
}

export function t(key: string, ...substitutions: string[]): string {
  try {
    // Prefer the runtime override locale if loaded
    const entry = _locale[key];
    if (entry) {
      let msg = entry.message;
      substitutions.forEach((sub, i) => {
        msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), sub);
      });
      return msg || key;
    }
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  } catch {
    return key;
  }
}
