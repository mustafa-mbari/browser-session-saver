import type { Prompt, PromptCategory, PromptFolder, PromptTag } from '@core/types/prompt.types';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';

const promptsAdapter = new ChromeLocalKeyAdapter<Prompt>('prompts');
const categoriesAdapter = new ChromeLocalKeyAdapter<PromptCategory>('prompt_categories');
const tagsAdapter = new ChromeLocalKeyAdapter<PromptTag>('prompt_tags');
const foldersAdapter = new ChromeLocalKeyAdapter<PromptFolder>('prompt_folders');

/** Migrate prompts that pre-date the `source` field by defaulting to 'local'. */
function migratePrompts(prompts: Prompt[]): Prompt[] {
  return prompts.map((p) =>
    p.source ? p : { ...p, source: 'local' as const },
  );
}

export const PromptStorage = {
  // ── Prompts ────────────────────────────────────────────────────────────

  async getAll(): Promise<Prompt[]> {
    const raw = await promptsAdapter.getAll();
    return migratePrompts(raw);
  },

  async save(prompt: Prompt): Promise<void> {
    const all = await promptsAdapter.getAll();
    const idx = all.findIndex((p) => p.id === prompt.id);
    if (idx >= 0) {
      all[idx] = prompt;
    } else {
      all.push(prompt);
    }
    await promptsAdapter.setAll(all);
  },

  async update(id: string, updates: Partial<Prompt>): Promise<void> {
    const all = await promptsAdapter.getAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
      await promptsAdapter.setAll(all);
    }
  },

  async delete(id: string): Promise<void> {
    const all = await promptsAdapter.getAll();
    await promptsAdapter.setAll(all.filter((p) => p.id !== id));
  },

  async deleteAll(): Promise<void> {
    await promptsAdapter.setAll([]);
  },

  async trackUsage(id: string): Promise<void> {
    const all = await promptsAdapter.getAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        usageCount: all[idx].usageCount + 1,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await promptsAdapter.setAll(all);
    }
  },

  // ── Folders ────────────────────────────────────────────────────────────

  getFolders(): Promise<PromptFolder[]> {
    return foldersAdapter.getAll();
  },

  async saveFolder(folder: PromptFolder): Promise<void> {
    const all = await foldersAdapter.getAll();
    const idx = all.findIndex((f) => f.id === folder.id);
    if (idx >= 0) {
      all[idx] = folder;
    } else {
      all.push(folder);
    }
    await foldersAdapter.setAll(all);
  },

  async deleteFolder(id: string): Promise<void> {
    // Delete folder and move its child prompts to parent (or root)
    const [folders, prompts] = await Promise.all([
      foldersAdapter.getAll(),
      promptsAdapter.getAll(),
    ]);
    const folder = folders.find((f) => f.id === id);
    // Re-parent child folders to the deleted folder's parent
    const updatedFolders = folders
      .filter((f) => f.id !== id)
      .map((f) =>
        f.parentId === id
          ? { ...f, parentId: folder?.parentId }
          : f,
      );
    // Clear folderId on prompts in this folder
    const updatedPrompts = prompts.map((p) =>
      p.folderId === id ? { ...p, folderId: undefined } : p,
    );
    await Promise.all([
      foldersAdapter.setAll(updatedFolders),
      promptsAdapter.setAll(updatedPrompts),
    ]);
  },

  // ── Categories ──────────────────────────────────────────────────────────

  getCategories(): Promise<PromptCategory[]> {
    return categoriesAdapter.getAll();
  },

  async saveCategory(category: PromptCategory): Promise<void> {
    const all = await categoriesAdapter.getAll();
    const idx = all.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      all[idx] = category;
    } else {
      all.push(category);
    }
    await categoriesAdapter.setAll(all);
  },

  async deleteCategory(id: string): Promise<void> {
    const all = await categoriesAdapter.getAll();
    await categoriesAdapter.setAll(all.filter((c) => c.id !== id));
  },

  // ── Tags ────────────────────────────────────────────────────────────────

  getTags(): Promise<PromptTag[]> {
    return tagsAdapter.getAll();
  },

  async saveTag(tag: PromptTag): Promise<void> {
    const all = await tagsAdapter.getAll();
    const idx = all.findIndex((t) => t.id === tag.id);
    if (idx >= 0) {
      all[idx] = tag;
    } else {
      all.push(tag);
    }
    await tagsAdapter.setAll(all);
  },

  async deleteTag(id: string): Promise<void> {
    const all = await tagsAdapter.getAll();
    await tagsAdapter.setAll(all.filter((t) => t.id !== id));
  },

  // ── Demo / Seed ─────────────────────────────────────────────────────────

  async seedDemoData(): Promise<void> {
    const now = new Date().toISOString();
    const d = (offsetDays: number) => {
      const t = new Date(); t.setDate(t.getDate() - offsetDays); return t.toISOString();
    };

    // Categories
    const cats: PromptCategory[] = [
      { id: 'demo-cat-writing',   name: 'Writing',   icon: '✍️', color: '#8b5cf6', createdAt: now },
      { id: 'demo-cat-coding',    name: 'Coding',    icon: '💻', color: '#3b82f6', createdAt: now },
      { id: 'demo-cat-marketing', name: 'Marketing', icon: '📣', color: '#ec4899', createdAt: now },
      { id: 'demo-cat-ai',        name: 'AI Tools',  icon: '🤖', color: '#f59e0b', createdAt: now },
    ];

    // Tags
    const tags: PromptTag[] = [
      { id: 'demo-tag-creative',  name: 'creative',  color: '#8b5cf6' },
      { id: 'demo-tag-technical', name: 'technical', color: '#3b82f6' },
      { id: 'demo-tag-quick',     name: 'quick',     color: '#10b981' },
      { id: 'demo-tag-template',  name: 'template',  color: '#f59e0b' },
    ];

    // Folders (local source)
    const folders: PromptFolder[] = [
      { id: 'demo-f-writing',  name: 'Writing',        parentId: undefined, position: 0, createdAt: now },
      { id: 'demo-f-blog',     name: 'Blog Posts',     parentId: 'demo-f-writing',  position: 0, createdAt: now },
      { id: 'demo-f-emails',   name: 'Emails',         parentId: 'demo-f-writing',  position: 1, createdAt: now },
      { id: 'demo-f-social',   name: 'Social Media',   parentId: 'demo-f-writing',  position: 2, createdAt: now },
      { id: 'demo-f-dev',      name: 'Development',    parentId: undefined, position: 1, createdAt: now },
      { id: 'demo-f-testing',  name: 'Testing',        parentId: 'demo-f-dev',      position: 0, createdAt: now },
      { id: 'demo-f-ai',       name: 'AI Prompts',     parentId: undefined, position: 2, createdAt: now },
      { id: 'demo-f-images',   name: 'Image Gen',      parentId: 'demo-f-ai',       position: 0, createdAt: now },
    ];

    // Prompts
    const prompts: Prompt[] = [
      {
        id: 'demo-p-1', title: 'Blog Post Introduction',
        content: 'Write a compelling blog post introduction about {{topic}} for {{audience}}. Start with a surprising fact or question, then explain why this topic matters in 2025.',
        description: 'Hook readers in the first paragraph',
        categoryId: 'demo-cat-writing', folderId: 'demo-f-blog', source: 'local',
        tags: ['demo-tag-creative', 'demo-tag-template'],
        isFavorite: true, isPinned: false, usageCount: 12,
        lastUsedAt: d(1), createdAt: d(10), updatedAt: d(1),
      },
      {
        id: 'demo-p-2', title: 'Professional Email',
        content: 'Write a professional email to {{recipient}} about {{subject}}. Keep it concise and polite. End with a clear call to action and next steps.',
        description: 'Quick professional email template',
        categoryId: 'demo-cat-writing', folderId: 'demo-f-emails', source: 'local',
        tags: ['demo-tag-quick', 'demo-tag-template'],
        isFavorite: false, isPinned: true, usageCount: 34,
        lastUsedAt: d(0), createdAt: d(20), updatedAt: d(0),
      },
      {
        id: 'demo-p-3', title: 'LinkedIn Thought Leadership',
        content: 'Create an engaging LinkedIn post about {{achievement_or_insight}}. Structure: 1) attention-grabbing hook, 2) personal story or data, 3) three key takeaways, 4) question to drive comments. Tone: {{tone}}.',
        description: 'Drive engagement on LinkedIn',
        categoryId: 'demo-cat-marketing', folderId: 'demo-f-social', source: 'local',
        tags: ['demo-tag-creative'],
        isFavorite: false, isPinned: false, usageCount: 7,
        lastUsedAt: d(3), createdAt: d(15), updatedAt: d(3),
      },
      {
        id: 'demo-p-4', title: 'Code Review Feedback',
        content: 'Review this {{language}} code for:\n1. Bugs and edge cases\n2. Performance bottlenecks\n3. Security vulnerabilities\n4. Readability and naming conventions\n\nProvide specific line-by-line feedback.\n\n```\n{{code}}\n```',
        description: 'Thorough code review template',
        categoryId: 'demo-cat-coding', folderId: 'demo-f-dev', source: 'local',
        tags: ['demo-tag-technical', 'demo-tag-template'],
        isFavorite: true, isPinned: true, usageCount: 28,
        lastUsedAt: d(0), createdAt: d(30), updatedAt: d(0),
      },
      {
        id: 'demo-p-5', title: 'Unit Test Generator',
        content: 'Generate comprehensive unit tests for this {{language}} function using {{test_framework}}.\n\nCover: happy path, edge cases, error conditions, and boundary values. Include mocks where needed.\n\n```\n{{function_code}}\n```',
        description: 'Generate full test coverage',
        categoryId: 'demo-cat-coding', folderId: 'demo-f-testing', source: 'local',
        tags: ['demo-tag-technical'],
        isFavorite: false, isPinned: false, usageCount: 15,
        lastUsedAt: d(2), createdAt: d(25), updatedAt: d(2),
      },
      {
        id: 'demo-p-6', title: 'SQL Query Optimizer',
        content: 'Write an optimized SQL query to {{task_description}}.\n\nInclude:\n- Efficient JOINs and WHERE clauses\n- Index recommendations\n- Query explanation\n- Alternative approach if applicable\n\nSchema context: {{schema}}',
        categoryId: 'demo-cat-coding', folderId: 'demo-f-dev', source: 'local',
        tags: ['demo-tag-technical'],
        isFavorite: false, isPinned: false, usageCount: 9,
        lastUsedAt: d(5), createdAt: d(18), updatedAt: d(5),
      },
      {
        id: 'demo-p-7', title: 'Meeting Notes Summary',
        content: 'Summarize this meeting transcript into:\n- **Attendees**: list of participants\n- **Key Decisions**: bullet points\n- **Action Items**: owner, task, deadline\n- **Open Questions**: unresolved items\n\nTranscript:\n{{transcript}}',
        description: 'Turn raw meeting notes into structured summary',
        categoryId: 'demo-cat-writing', folderId: undefined, source: 'local',
        tags: ['demo-tag-quick'],
        isFavorite: false, isPinned: false, usageCount: 22,
        lastUsedAt: d(1), createdAt: d(12), updatedAt: d(1),
      },
      {
        id: 'demo-p-8', title: 'Custom AI Persona',
        content: 'You are {{persona_name}}, an expert in {{domain}}. You communicate in a {{communication_style}} tone and always provide {{output_format}} responses. Your goal is to help users with {{primary_goal}}. Never {{constraint}}.',
        description: 'Define a custom GPT system prompt',
        categoryId: 'demo-cat-ai', folderId: 'demo-f-ai', source: 'app',
        tags: ['demo-tag-template'],
        isFavorite: true, isPinned: false, usageCount: 18,
        lastUsedAt: d(2), createdAt: d(8), updatedAt: d(2),
      },
      {
        id: 'demo-p-9', title: 'Image Generation Prompt',
        content: '{{style}} illustration of {{subject}}. Lighting: {{lighting}}. Color palette: {{colors}}. Mood: {{mood}}. Artistic style inspired by {{artist_reference}}. High resolution, detailed, cinematic composition.',
        description: 'Structured prompt for AI image tools',
        categoryId: 'demo-cat-ai', folderId: 'demo-f-images', source: 'app',
        tags: ['demo-tag-creative', 'demo-tag-template'],
        isFavorite: false, isPinned: true, usageCount: 41,
        lastUsedAt: d(0), createdAt: d(6), updatedAt: d(0),
      },
      {
        id: 'demo-p-10', title: 'Data Analysis Assistant',
        content: 'Analyze this dataset and provide:\n1. Key statistical insights (mean, median, outliers)\n2. Notable patterns or anomalies\n3. Actionable business recommendations\n4. Suggested chart types for visualization\n\nData:\n{{data_or_description}}',
        categoryId: 'demo-cat-ai', folderId: 'demo-f-ai', source: 'app',
        tags: ['demo-tag-technical'],
        isFavorite: false, isPinned: false, usageCount: 6,
        lastUsedAt: d(4), createdAt: d(14), updatedAt: d(4),
      },
      {
        id: 'demo-p-11', title: 'Product Description Writer',
        content: 'Write a compelling product description for {{product_name}}.\n\nTarget audience: {{target_audience}}\nKey features: {{features}}\nTone: {{tone}} (e.g. professional, playful, luxurious)\nLength: {{word_count}} words\n\nInclude: headline, 2–3 benefit statements, and a call to action.',
        description: 'E-commerce ready product copy',
        categoryId: 'demo-cat-marketing', folderId: 'demo-f-social', source: 'app',
        tags: ['demo-tag-creative', 'demo-tag-template'],
        isFavorite: false, isPinned: false, usageCount: 11,
        lastUsedAt: d(3), createdAt: d(9), updatedAt: d(3),
      },
    ];

    // Merge with existing data (skip IDs that already exist)
    const [existingPrompts, existingCats, existingTags, existingFolders] = await Promise.all([
      promptsAdapter.getAll(),
      categoriesAdapter.getAll(),
      tagsAdapter.getAll(),
      foldersAdapter.getAll(),
    ]);

    const existingPromptIds = new Set(existingPrompts.map((p) => p.id));
    const existingCatIds = new Set(existingCats.map((c) => c.id));
    const existingTagIds = new Set(existingTags.map((t) => t.id));
    const existingFolderIds = new Set(existingFolders.map((f) => f.id));

    await Promise.all([
      promptsAdapter.setAll([
        ...existingPrompts,
        ...prompts.filter((p) => !existingPromptIds.has(p.id)),
      ]),
      categoriesAdapter.setAll([
        ...existingCats,
        ...cats.filter((c) => !existingCatIds.has(c.id)),
      ]),
      tagsAdapter.setAll([
        ...existingTags,
        ...tags.filter((t) => !existingTagIds.has(t.id)),
      ]),
      foldersAdapter.setAll([
        ...existingFolders,
        ...folders.filter((f) => !existingFolderIds.has(f.id)),
      ]),
    ]);
  },
};
