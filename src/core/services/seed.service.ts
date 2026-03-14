import type { NewTabDB } from '@core/storage/newtab-storage';
import type { Board, BookmarkCategory, BookmarkEntry, TodoList } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';
import { getFaviconUrl } from '@core/utils/favicon';

/** Returns ISO string staggered by `offsetMs` from a base time. */
function ts(base: number, offsetMs: number): string {
  return new Date(base + offsetMs).toISOString();
}

interface SeedResult {
  mainBoard: Board;
  bookmarksBoard: Board;
  todoList: TodoList;
}

/**
 * Seeds the two default boards (Main + Bookmarks) and a default TodoList.
 * Should only be called when the DB has no boards yet.
 */
export async function seedDefaultData(db: NewTabDB): Promise<SeedResult> {
  const base = Date.now();

  // ── Main board cards ──────────────────────────────────────────────────────

  const mainBoardId = generateId();

  const noteCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Note',
    icon: '📝',
    color: '#f59e0b',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 1,
    cardType: 'note',
    noteContent: '',
    createdAt: ts(base, 0),
  };

  const clockCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Clock',
    icon: '🕐',
    color: '#06b6d4',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 1,
    cardType: 'clock',
    createdAt: ts(base, 1),
  };

  const todoCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'To-Do',
    icon: '✅',
    color: '#22c55e',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 1,
    cardType: 'todo',
    noteContent: '[]',
    createdAt: ts(base, 2),
  };

  const privateCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Private',
    icon: '📁',
    color: '#6366f1',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 2,
    cardType: 'bookmark',
    createdAt: ts(base, 3),
  };

  const workCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Work',
    icon: '💼',
    color: '#3b82f6',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 2,
    cardType: 'bookmark',
    createdAt: ts(base, 4),
  };

  const mainCards = [noteCard, clockCard, todoCard, privateCard, workCard];

  const mainBoard: Board = {
    id: mainBoardId,
    name: 'Main',
    icon: '🏠',
    categoryIds: mainCards.map((c) => c.id),
    createdAt: ts(base, 0),
    updatedAt: ts(base, 0),
  };

  // ── Default TodoList (for the TodoWidget in Focus / Minimal layouts) ───────

  const todoList: TodoList = {
    id: generateId(),
    name: 'My Tasks',
    icon: '✅',
    position: 0,
    createdAt: ts(base, 0),
  };

  // ── Bookmarks board ───────────────────────────────────────────────────────

  const bookmarksBoardId = generateId();

  const categoryDefs: Array<{
    name: string;
    icon: string;
    color: string;
    colSpan?: 1 | 2 | 3;
    links: Array<{ title: string; url: string }>;
  }> = [
    {
      name: 'AI Tools',
      icon: '🤖',
      color: '#8b5cf6',
      colSpan: 2,
      links: [
        { title: 'ChatGPT',        url: 'https://chatgpt.com' },
        { title: 'Claude',         url: 'https://claude.ai' },
        { title: 'Gemini',         url: 'https://gemini.google.com/app' },
        { title: 'Perplexity',     url: 'https://www.perplexity.ai' },
        { title: 'Grok',           url: 'https://grok.com' },
        { title: 'Mistral',        url: 'https://mistral.ai' },
        { title: 'Midjourney',     url: 'https://www.midjourney.com' },
        { title: 'GitHub Copilot', url: 'https://github.com/features/copilot' },
      ],
    },
    {
      name: 'Development',
      icon: '💻',
      color: '#3b82f6',
      colSpan: 2,
      links: [
        { title: 'GitHub',        url: 'https://github.com' },
        { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
        { title: 'MDN Web Docs',  url: 'https://developer.mozilla.org' },
        { title: 'npm',           url: 'https://npmjs.com' },
        { title: 'DevDocs',       url: 'https://devdocs.io' },
        { title: 'Can I Use',     url: 'https://caniuse.com' },
        { title: 'CodePen',       url: 'https://codepen.io' },
        { title: 'Vercel',        url: 'https://vercel.com' },
        { title: 'Netlify',       url: 'https://netlify.com' },
        { title: 'Replit',        url: 'https://replit.com' },
      ],
    },
    {
      name: 'Productivity',
      icon: '📋',
      color: '#f59e0b',
      links: [
        { title: 'Google Docs',     url: 'https://docs.google.com' },
        { title: 'Google Sheets',   url: 'https://sheets.google.com' },
        { title: 'Google Drive',    url: 'https://drive.google.com' },
        { title: 'Gmail',           url: 'https://mail.google.com' },
        { title: 'Google Calendar', url: 'https://calendar.google.com' },
        { title: 'Notion',          url: 'https://notion.so' },
        { title: 'Trello',          url: 'https://trello.com' },
        { title: 'Todoist',         url: 'https://todoist.com' },
      ],
    },
    {
      name: 'Social',
      icon: '💬',
      color: '#ec4899',
      links: [
        { title: 'X (Twitter)',  url: 'https://x.com' },
        { title: 'Reddit',       url: 'https://reddit.com' },
        { title: 'LinkedIn',     url: 'https://linkedin.com' },
        { title: 'Instagram',    url: 'https://instagram.com' },
        { title: 'Facebook',     url: 'https://facebook.com' },
        { title: 'WhatsApp Web', url: 'https://web.whatsapp.com' },
        { title: 'Discord',      url: 'https://discord.com/app' },
        { title: 'Telegram Web', url: 'https://web.telegram.org' },
      ],
    },
    {
      name: 'Search',
      icon: '🔍',
      color: '#10b981',
      links: [
        { title: 'Google',       url: 'https://google.com' },
        { title: 'DuckDuckGo',   url: 'https://duckduckgo.com' },
        { title: 'Brave Search', url: 'https://search.brave.com' },
        { title: 'Bing',         url: 'https://bing.com' },
        { title: 'Wolfram Alpha', url: 'https://wolframalpha.com' },
        { title: 'Perplexity',   url: 'https://www.perplexity.ai' },
      ],
    },
    {
      name: 'News & Tech',
      icon: '📰',
      color: '#ef4444',
      links: [
        { title: 'Hacker News', url: 'https://news.ycombinator.com' },
        { title: 'The Verge',   url: 'https://theverge.com' },
        { title: 'TechCrunch',  url: 'https://techcrunch.com' },
        { title: 'Wired',       url: 'https://wired.com' },
        { title: 'Ars Technica', url: 'https://arstechnica.com' },
        { title: 'BBC News',    url: 'https://bbc.com/news' },
        { title: 'Reuters',     url: 'https://reuters.com' },
      ],
    },
    {
      name: 'Design',
      icon: '🎨',
      color: '#f97316',
      links: [
        { title: 'Figma',     url: 'https://figma.com' },
        { title: 'Dribbble',  url: 'https://dribbble.com' },
        { title: 'Behance',   url: 'https://behance.net' },
        { title: 'Unsplash',  url: 'https://unsplash.com' },
        { title: 'Canva',     url: 'https://canva.com' },
        { title: 'Pexels',    url: 'https://pexels.com' },
        { title: 'Coolors',   url: 'https://coolors.co' },
        { title: 'Font Awesome', url: 'https://fontawesome.com' },
      ],
    },
    {
      name: 'Learning',
      icon: '📚',
      color: '#06b6d4',
      links: [
        { title: 'Udemy',         url: 'https://udemy.com' },
        { title: 'Coursera',      url: 'https://coursera.org' },
        { title: 'freeCodeCamp', url: 'https://freecodecamp.org' },
        { title: 'Khan Academy',  url: 'https://khanacademy.org' },
        { title: 'Pluralsight',   url: 'https://pluralsight.com' },
        { title: 'edX',           url: 'https://edx.org' },
        { title: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu' },
      ],
    },
    {
      name: 'Video & Music',
      icon: '🎬',
      color: '#dc2626',
      links: [
        { title: 'YouTube',   url: 'https://youtube.com' },
        { title: 'Netflix',   url: 'https://netflix.com' },
        { title: 'Twitch',    url: 'https://twitch.tv' },
        { title: 'Spotify',   url: 'https://open.spotify.com' },
        { title: 'SoundCloud', url: 'https://soundcloud.com' },
        { title: 'Disney+',   url: 'https://disneyplus.com' },
        { title: 'Prime Video', url: 'https://primevideo.com' },
      ],
    },
    {
      name: 'Shopping',
      icon: '🛒',
      color: '#84cc16',
      links: [
        { title: 'Amazon',     url: 'https://amazon.com' },
        { title: 'eBay',       url: 'https://ebay.com' },
        { title: 'AliExpress', url: 'https://aliexpress.com' },
        { title: 'Etsy',       url: 'https://etsy.com' },
        { title: 'ASOS',       url: 'https://asos.com' },
      ],
    },
  ];

  const bookmarkCategories: BookmarkCategory[] = [];
  const bookmarkEntries: BookmarkEntry[] = [];

  categoryDefs.forEach((def, idx) => {
    const catId = generateId();
    const entryIds: string[] = [];

    def.links.forEach((link) => {
      const entry: BookmarkEntry = {
        id: generateId(),
        categoryId: catId,
        title: link.title,
        url: link.url,
        favIconUrl: getFaviconUrl(link.url),
        addedAt: ts(base, idx * 100 + bookmarkEntries.length),
        isNative: false,
      };
      entryIds.push(entry.id);
      bookmarkEntries.push(entry);
    });

    bookmarkCategories.push({
      id: catId,
      boardId: bookmarksBoardId,
      name: def.name,
      icon: def.icon,
      color: def.color,
      bookmarkIds: entryIds,
      collapsed: false,
      colSpan: def.colSpan ?? 1,
      rowSpan: 1,
      cardType: 'bookmark',
      createdAt: ts(base, idx * 100),
    });
  });

  const bookmarksBoard: Board = {
    id: bookmarksBoardId,
    name: 'Bookmarks',
    icon: '🔖',
    categoryIds: bookmarkCategories.map((c) => c.id),
    createdAt: ts(base, 1),
    updatedAt: ts(base, 1),
  };

  // ── Write everything to DB in one batch ───────────────────────────────────

  await Promise.all([
    db.put('boards', mainBoard),
    db.put('boards', bookmarksBoard),
    db.put('todoLists', todoList),
    ...mainCards.map((c) => db.put('bookmarkCategories', c)),
    ...bookmarkCategories.map((c) => db.put('bookmarkCategories', c)),
    ...bookmarkEntries.map((e) => db.put('bookmarkEntries', e)),
  ]);

  return { mainBoard, bookmarksBoard, todoList };
}
