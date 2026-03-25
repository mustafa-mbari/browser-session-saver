import type {
  Prompt,
  PromptFilterOptions,
  PromptFolder,
  PromptSectionKey,
  PromptSortField,
} from '@core/types/prompt.types';

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export const PromptService = {
  /**
   * Extract unique variable names from {{variable}} placeholders in content.
   */
  extractVariables(content: string): string[] {
    const matches = [...content.matchAll(VARIABLE_REGEX)];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of matches) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        result.push(m[1]);
      }
    }
    return result;
  },

  /**
   * Replace all {{variable}} placeholders with user-supplied values.
   * Missing values are left as-is.
   */
  applyVariables(content: string, values: Record<string, string>): string {
    return content.replace(VARIABLE_REGEX, (match, name: string) =>
      values[name] !== undefined ? values[name] : match,
    );
  },

  /**
   * Filter a list of prompts based on search text, category, tags, folder, source, and flags.
   */
  filterPrompts(prompts: Prompt[], opts: PromptFilterOptions): Prompt[] {
    const { search, categoryId, tagIds, favoritesOnly, pinnedOnly, folderId, source } = opts;
    const query = search?.trim().toLowerCase();

    return prompts.filter((p) => {
      if (favoritesOnly && !p.isFavorite) return false;
      if (pinnedOnly && !p.isPinned) return false;
      if (categoryId && p.categoryId !== categoryId) return false;
      if (folderId !== undefined && p.folderId !== folderId) return false;
      if (source && p.source !== source) return false;
      if (tagIds && tagIds.length > 0 && !tagIds.some((t) => p.tags.includes(t))) return false;
      if (query) {
        const inTitle = p.title.toLowerCase().includes(query);
        const inContent = p.content.toLowerCase().includes(query);
        const inDesc = p.description?.toLowerCase().includes(query) ?? false;
        if (!inTitle && !inContent && !inDesc) return false;
      }
      return true;
    });
  },

  /**
   * Return prompts that belong to a given section key.
   *
   * - 'start'        → last 10 used (sorted by lastUsedAt desc)
   * - 'quick-access' → pinned prompts
   * - 'all'          → all prompts (no filter)
   * - 'favorites'    → isFavorite === true
   * - 'local'        → source === 'local'
   * - 'app'          → source === 'app'
   */
  filterBySection(prompts: Prompt[], section: PromptSectionKey): Prompt[] {
    switch (section) {
      case 'start':
        return prompts
          .filter((p) => p.lastUsedAt)
          .sort((a, b) => (b.lastUsedAt! > a.lastUsedAt! ? 1 : -1))
          .slice(0, 10);
      case 'quick-access':
        return prompts.filter((p) => p.isPinned);
      case 'all':
        return prompts;
      case 'favorites':
        return prompts.filter((p) => p.isFavorite);
      case 'local':
        return prompts.filter((p) => p.source === 'local');
      case 'app':
        return prompts.filter((p) => p.source === 'app');
    }
  },

  /**
   * Return all prompts in a folder (and optionally its sub-folders recursively).
   */
  getPromptsInFolder(
    prompts: Prompt[],
    folderId: string,
    folders: PromptFolder[],
    recursive = true,
  ): Prompt[] {
    if (!recursive) {
      return prompts.filter((p) => p.folderId === folderId);
    }
    // Collect all descendant folder ids
    const allIds = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of folders) {
        if (f.parentId && allIds.has(f.parentId) && !allIds.has(f.id)) {
          allIds.add(f.id);
          changed = true;
        }
      }
    }
    return prompts.filter((p) => p.folderId && allIds.has(p.folderId));
  },

  /**
   * Build a flat sorted list of root-level folders, then their children in depth-first order.
   */
  buildFolderTree(folders: PromptFolder[]): PromptFolder[] {
    const byParent = new Map<string | undefined, PromptFolder[]>();
    for (const f of folders) {
      const key = f.parentId ?? undefined;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(f);
    }
    const sortFn = (a: PromptFolder, b: PromptFolder) => a.position - b.position;

    function flatten(parentId?: string): PromptFolder[] {
      const children = (byParent.get(parentId) ?? []).sort(sortFn);
      return children.flatMap((f) => [f, ...flatten(f.id)]);
    }
    return flatten(undefined);
  },

  /**
   * Sort prompts by a field, ascending or descending.
   */
  sortPrompts(
    prompts: Prompt[],
    field: PromptSortField,
    direction: 'asc' | 'desc',
  ): Prompt[] {
    const sorted = [...prompts].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (field === 'title') {
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
      } else if (field === 'usageCount') {
        aVal = a.usageCount;
        bVal = b.usageCount;
      } else {
        aVal = (field === 'lastUsedAt' ? a.lastUsedAt : field === 'updatedAt' ? a.updatedAt : a.createdAt) ?? '';
        bVal = (field === 'lastUsedAt' ? b.lastUsedAt : field === 'updatedAt' ? b.updatedAt : b.createdAt) ?? '';
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  },

  /**
   * Return the N most recently used prompts (those with lastUsedAt set).
   */
  getRecentPrompts(prompts: Prompt[], limit = 5): Prompt[] {
    return prompts
      .filter((p) => p.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt! > a.lastUsedAt! ? 1 : -1))
      .slice(0, limit);
  },

  /**
   * Return all pinned prompts.
   */
  getPinnedPrompts(prompts: Prompt[]): Prompt[] {
    return prompts.filter((p) => p.isPinned);
  },
};
