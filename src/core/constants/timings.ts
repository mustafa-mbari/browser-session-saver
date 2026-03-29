/** Debounce delay (ms) for updating the window tab cache on tab events. */
export const TAB_CACHE_DEBOUNCE_MS = 5_000;

/** Timeout (ms) for chrome.runtime.sendMessage round trips. */
export const MESSAGE_TIMEOUT_MS = 10_000;

/** How long to show ephemeral copy/action toasts before auto-dismissing (ms). */
export const TOAST_DISMISS_MS = 2_500;

/** How old a restore-prompt record can be before it is discarded (ms). */
export const RESTORE_PROMPT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
