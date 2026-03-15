import { isValidUrl } from './validators';

/** Open a URL in a new browser tab/window only if it passes URL validation. */
export function safeOpenUrl(url: string | undefined | null, target: '_blank' | '_self' = '_blank'): void {
  if (url && isValidUrl(url)) {
    window.open(url, target);
  }
}
