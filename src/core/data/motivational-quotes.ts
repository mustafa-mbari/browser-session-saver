import rawEn from '../../../md_files/motivational_quotes_en.txt?raw';
import rawAr from '../../../md_files/motivational_quotes_ar.txt?raw';
import rawDe from '../../../md_files/motivational_quotes_de.txt?raw';
import type { AppLanguage } from '@core/types/newtab.types';

const QUOTES_EN: readonly string[] = rawEn.trim().split('\n').filter(Boolean);
const QUOTES_AR: readonly string[] = rawAr.trim().split('\n').filter(Boolean);
const QUOTES_DE: readonly string[] = rawDe.trim().split('\n').filter(Boolean);

/** @deprecated use getQuotesForLanguage() */
export const MOTIVATIONAL_QUOTES: readonly string[] = QUOTES_EN;

function detectBrowserLanguage(): 'en' | 'ar' | 'de' {
  const lang = (navigator.language ?? '').toLowerCase();
  if (lang.startsWith('ar')) return 'ar';
  if (lang.startsWith('de')) return 'de';
  return 'en';
}

export function getQuotesForLanguage(language: AppLanguage): readonly string[] {
  const resolved = language === 'auto' ? detectBrowserLanguage() : language;
  if (resolved === 'ar') return QUOTES_AR;
  if (resolved === 'de') return QUOTES_DE;
  return QUOTES_EN;
}
