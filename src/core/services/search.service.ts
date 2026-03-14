import type { Session } from '@core/types/session.types';

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

export function searchSessions(sessions: Session[], query: string): Session[] {
  if (!query.trim()) return sessions;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = sessions
    .map((session) => {
      let score = 0;
      const searchText = buildSearchText(session);

      for (const term of terms) {
        if (session.name.toLowerCase().includes(term)) score += 10;
        if (session.tags.some((t) => t.toLowerCase().includes(term))) score += 8;
        if (session.tabs.some((t) => t.title.toLowerCase().includes(term))) score += 5;
        if (session.tabs.some((t) => t.url.toLowerCase().includes(term))) score += 3;
        if (searchText.includes(term)) score += 1;
      }

      return { session, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.session);
}

export function highlightMatches(text: string, query: string): HighlightSegment[] {
  if (!query.trim()) return [{ text, highlighted: false }];

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const parts = text.split(regex);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: regex.test(part),
    }));
}

function buildSearchText(session: Session): string {
  const parts = [
    session.name,
    ...session.tags,
    session.notes,
    ...session.tabs.map((t) => `${t.title} ${t.url}`),
    ...session.tabGroups.map((g) => g.title),
  ];
  return parts.join(' ').toLowerCase();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
