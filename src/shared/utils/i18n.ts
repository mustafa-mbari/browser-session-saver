interface LocaleMessage {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

// Runtime locale cache — populated by loadLocale() on app start
let _locale: Record<string, LocaleMessage> = {};

/**
 * Format a messages.json entry the way chrome.i18n.getMessage does: named
 * placeholders ($COUNT$ -> their "content", e.g. $1) first, then $1..$9.
 */
export function formatMessage(entry: LocaleMessage, substitutions: string[]): string {
  let msg = entry.message;
  for (const [name, { content }] of Object.entries(entry.placeholders ?? {})) {
    msg = msg.replace(new RegExp(`\\$${name}\\$`, 'gi'), () => content);
  }
  substitutions.forEach((sub, i) => {
    msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), () => sub);
  });
  return msg;
}

/**
 * Load a locale's messages.json from the extension bundle.
 * Call once on app boot when settings.language !== 'auto'.
 */
export async function loadLocale(lang: string): Promise<void> {
  if (lang === 'auto') { _locale = {}; return; }
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    _locale = (await res.json()) as Record<string, LocaleMessage>;
  } catch {
    _locale = {};
  }
}

export function t(key: string, ...substitutions: string[]): string {
  try {
    // Prefer the runtime override locale if loaded
    const entry = _locale[key];
    if (entry) return formatMessage(entry, substitutions) || key;
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  } catch {
    return key;
  }
}
