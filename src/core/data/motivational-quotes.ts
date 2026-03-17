import raw from '../../../md_files/motivational_quotes.txt?raw';

export const MOTIVATIONAL_QUOTES: readonly string[] = raw.trim().split('\n').filter(Boolean);
