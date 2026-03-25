import { describe, it, expect } from 'vitest';
import { PromptService } from '@core/services/prompt.service';
import type { Prompt, PromptFolder } from '@core/types/prompt.types';

function makePrompt(id: string, overrides: Partial<Prompt> = {}): Prompt {
  return {
    id,
    title: `Prompt ${id}`,
    content: `Default content for ${id}`,
    tags: [],
    source: 'local',
    isFavorite: false,
    isPinned: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── extractVariables ─────────────────────────────────────────────────────────

describe('PromptService.extractVariables', () => {
  it('returns empty array when no variables', () => {
    expect(PromptService.extractVariables('Hello world')).toEqual([]);
  });

  it('extracts a single variable', () => {
    expect(PromptService.extractVariables('Hello {{name}}')).toEqual(['name']);
  });

  it('extracts multiple unique variables', () => {
    const vars = PromptService.extractVariables('Email to {{name}} about {{topic}}');
    expect(vars).toEqual(['name', 'topic']);
  });

  it('deduplicates repeated variable names', () => {
    const vars = PromptService.extractVariables('{{name}} and {{name}} again');
    expect(vars).toEqual(['name']);
  });

  it('preserves order of first occurrence', () => {
    const vars = PromptService.extractVariables('{{b}} then {{a}}');
    expect(vars).toEqual(['b', 'a']);
  });
});

// ── applyVariables ───────────────────────────────────────────────────────────

describe('PromptService.applyVariables', () => {
  it('replaces a single variable', () => {
    const result = PromptService.applyVariables('Hello {{name}}', { name: 'Alice' });
    expect(result).toBe('Hello Alice');
  });

  it('replaces all occurrences of the same variable', () => {
    const result = PromptService.applyVariables('{{x}} + {{x}}', { x: '1' });
    expect(result).toBe('1 + 1');
  });

  it('leaves unreplaced variables intact when value is missing', () => {
    const result = PromptService.applyVariables('{{a}} and {{b}}', { a: 'yes' });
    expect(result).toBe('yes and {{b}}');
  });

  it('replaces multiple different variables', () => {
    const result = PromptService.applyVariables('{{greeting}}, {{person}}!', {
      greeting: 'Hello',
      person: 'World',
    });
    expect(result).toBe('Hello, World!');
  });
});

// ── filterPrompts ────────────────────────────────────────────────────────────

describe('PromptService.filterPrompts', () => {
  const prompts: Prompt[] = [
    makePrompt('1', { title: 'Blog intro', content: 'Write a blog', isFavorite: true }),
    makePrompt('2', { title: 'Email draft', content: 'Draft an email', tags: ['tag1'] }),
    makePrompt('3', { title: 'Tweet', content: 'Tweet about something', categoryId: 'cat1' }),
  ];

  it('returns all prompts with empty opts', () => {
    expect(PromptService.filterPrompts(prompts, {})).toHaveLength(3);
  });

  it('filters by search on title', () => {
    const result = PromptService.filterPrompts(prompts, { search: 'blog' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by search on content', () => {
    const result = PromptService.filterPrompts(prompts, { search: 'email' });
    expect(result.map((p) => p.id)).toContain('2');
  });

  it('filters by favoritesOnly', () => {
    const result = PromptService.filterPrompts(prompts, { favoritesOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by categoryId', () => {
    const result = PromptService.filterPrompts(prompts, { categoryId: 'cat1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters by tagIds (any match)', () => {
    const result = PromptService.filterPrompts(prompts, { tagIds: ['tag1'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when no prompts match search', () => {
    const result = PromptService.filterPrompts(prompts, { search: 'xyznonexistent' });
    expect(result).toHaveLength(0);
  });
});

// ── sortPrompts ──────────────────────────────────────────────────────────────

describe('PromptService.sortPrompts', () => {
  const prompts: Prompt[] = [
    makePrompt('1', { title: 'Banana', usageCount: 5, createdAt: '2025-01-03T00:00:00.000Z', updatedAt: '2025-01-03T00:00:00.000Z' }),
    makePrompt('2', { title: 'Apple', usageCount: 1, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }),
    makePrompt('3', { title: 'Cherry', usageCount: 3, createdAt: '2025-01-02T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z' }),
  ];

  it('sorts by title ascending', () => {
    const result = PromptService.sortPrompts(prompts, 'title', 'asc');
    expect(result.map((p) => p.title)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('sorts by title descending', () => {
    const result = PromptService.sortPrompts(prompts, 'title', 'desc');
    expect(result.map((p) => p.title)).toEqual(['Cherry', 'Banana', 'Apple']);
  });

  it('sorts by usageCount descending', () => {
    const result = PromptService.sortPrompts(prompts, 'usageCount', 'desc');
    expect(result.map((p) => p.id)).toEqual(['1', '3', '2']);
  });

  it('sorts by createdAt ascending', () => {
    const result = PromptService.sortPrompts(prompts, 'createdAt', 'asc');
    expect(result.map((p) => p.id)).toEqual(['2', '3', '1']);
  });

  it('does not mutate the original array', () => {
    const copy = [...prompts];
    PromptService.sortPrompts(prompts, 'title', 'asc');
    expect(prompts).toEqual(copy);
  });
});

// ── getRecentPrompts ─────────────────────────────────────────────────────────

describe('PromptService.getRecentPrompts', () => {
  it('returns empty array when no prompts have been used', () => {
    const prompts = [makePrompt('1'), makePrompt('2')];
    expect(PromptService.getRecentPrompts(prompts)).toHaveLength(0);
  });

  it('returns prompts sorted by lastUsedAt descending', () => {
    const prompts = [
      makePrompt('1', { lastUsedAt: '2025-01-01T10:00:00.000Z' }),
      makePrompt('2', { lastUsedAt: '2025-01-03T10:00:00.000Z' }),
      makePrompt('3', { lastUsedAt: '2025-01-02T10:00:00.000Z' }),
    ];
    const result = PromptService.getRecentPrompts(prompts);
    expect(result.map((p) => p.id)).toEqual(['2', '3', '1']);
  });

  it('respects the limit parameter', () => {
    const prompts = Array.from({ length: 10 }, (_, i) =>
      makePrompt(String(i), { lastUsedAt: `2025-01-0${i + 1}T00:00:00.000Z` }),
    );
    const result = PromptService.getRecentPrompts(prompts, 3);
    expect(result).toHaveLength(3);
  });

  it('excludes prompts without lastUsedAt', () => {
    const prompts = [
      makePrompt('1', { lastUsedAt: '2025-01-01T00:00:00.000Z' }),
      makePrompt('2'),
    ];
    const result = PromptService.getRecentPrompts(prompts);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

// ── getPinnedPrompts ──────────────────────────────────────────────────────────

describe('PromptService.getPinnedPrompts', () => {
  it('returns only pinned prompts', () => {
    const prompts = [
      makePrompt('1', { isPinned: true }),
      makePrompt('2', { isPinned: false }),
      makePrompt('3', { isPinned: true }),
    ];
    const result = PromptService.getPinnedPrompts(prompts);
    expect(result.map((p) => p.id)).toEqual(['1', '3']);
  });

  it('returns empty array when none are pinned', () => {
    const prompts = [makePrompt('a'), makePrompt('b')];
    expect(PromptService.getPinnedPrompts(prompts)).toHaveLength(0);
  });
});

// ── filterBySection ──────────────────────────────────────────────────────────

describe('PromptService.filterBySection', () => {
  const now = new Date().toISOString();
  const prompts: Prompt[] = [
    makePrompt('1', { isPinned: true, source: 'local', isFavorite: true, lastUsedAt: '2025-01-05T00:00:00.000Z' }),
    makePrompt('2', { source: 'app', isFavorite: false }),
    makePrompt('3', { source: 'local', isFavorite: true, lastUsedAt: '2025-01-03T00:00:00.000Z' }),
    makePrompt('4', { source: 'app', isPinned: true }),
  ];

  it('start returns prompts with lastUsedAt sorted desc', () => {
    const result = PromptService.filterBySection(prompts, 'start');
    expect(result.map((p) => p.id)).toEqual(['1', '3']);
  });

  it('quick-access returns pinned prompts', () => {
    const result = PromptService.filterBySection(prompts, 'quick-access');
    expect(result.map((p) => p.id)).toEqual(['1', '4']);
  });

  it('all returns all prompts', () => {
    expect(PromptService.filterBySection(prompts, 'all')).toHaveLength(4);
  });

  it('favorites returns only favorites', () => {
    const result = PromptService.filterBySection(prompts, 'favorites');
    expect(result.map((p) => p.id)).toEqual(['1', '3']);
  });

  it('local returns only local-source prompts', () => {
    const result = PromptService.filterBySection(prompts, 'local');
    expect(result.map((p) => p.id)).toEqual(['1', '3']);
  });

  it('app returns only app-source prompts', () => {
    const result = PromptService.filterBySection(prompts, 'app');
    expect(result.map((p) => p.id)).toEqual(['2', '4']);
  });
});

// ── getPromptsInFolder ────────────────────────────────────────────────────────

function makeFolder(id: string, parentId?: string): PromptFolder {
  return { id, name: `Folder ${id}`, parentId, position: 0, createdAt: '' };
}

describe('PromptService.getPromptsInFolder', () => {
  const folders: PromptFolder[] = [
    makeFolder('f1'),
    makeFolder('f2', 'f1'),  // child of f1
    makeFolder('f3', 'f2'),  // grandchild of f1
  ];
  const prompts: Prompt[] = [
    makePrompt('p1', { folderId: 'f1' }),
    makePrompt('p2', { folderId: 'f2' }),
    makePrompt('p3', { folderId: 'f3' }),
    makePrompt('p4'),          // no folder
  ];

  it('returns only direct folder prompts when recursive=false', () => {
    const result = PromptService.getPromptsInFolder(prompts, 'f1', folders, false);
    expect(result.map((p) => p.id)).toEqual(['p1']);
  });

  it('returns all descendant prompts when recursive=true (default)', () => {
    const result = PromptService.getPromptsInFolder(prompts, 'f1', folders);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('returns empty array when folder has no prompts', () => {
    const result = PromptService.getPromptsInFolder(prompts, 'f99', folders);
    expect(result).toHaveLength(0);
  });
});

// ── buildFolderTree ───────────────────────────────────────────────────────────

describe('PromptService.buildFolderTree', () => {
  it('returns root folders when no nesting', () => {
    const folders: PromptFolder[] = [
      { id: 'a', name: 'A', position: 1, createdAt: '' },
      { id: 'b', name: 'B', position: 0, createdAt: '' },
    ];
    const result = PromptService.buildFolderTree(folders);
    expect(result.map((f) => f.id)).toEqual(['b', 'a']); // sorted by position
  });

  it('interleaves children after their parent in depth-first order', () => {
    const folders: PromptFolder[] = [
      { id: 'root', name: 'Root', position: 0, createdAt: '' },
      { id: 'child1', name: 'C1', parentId: 'root', position: 0, createdAt: '' },
      { id: 'child2', name: 'C2', parentId: 'root', position: 1, createdAt: '' },
    ];
    const result = PromptService.buildFolderTree(folders);
    expect(result.map((f) => f.id)).toEqual(['root', 'child1', 'child2']);
  });
});
