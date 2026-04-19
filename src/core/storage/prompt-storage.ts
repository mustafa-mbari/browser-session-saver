import type { Prompt, PromptCategory, PromptFolder, PromptTag } from '@core/types/prompt.types';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';
import { ChromeLocalArrayRepository } from './chrome-local-array-repository';
import { guardAction, trackAction } from '@core/services/limits/limit-guard';
import { withStorageLock } from './storage-mutex';

const promptsRepo = new ChromeLocalArrayRepository<Prompt>('prompts');
const foldersRepo = new ChromeLocalArrayRepository<PromptFolder>('prompt_folders');
const categoriesAdapter = new ChromeLocalKeyAdapter<PromptCategory>('prompt_categories');
const tagsAdapter = new ChromeLocalKeyAdapter<PromptTag>('prompt_tags');

/** Expose repositories for direct access (e.g. sync layer). */
export function getPromptRepository() { return promptsRepo; }
export function getPromptFolderRepository() { return foldersRepo; }

/** Migrate prompts that pre-date the `source` field by defaulting to 'local'. */
function migratePrompts(prompts: Prompt[]): Prompt[] {
  return prompts.map((p) =>
    p.source ? p : { ...p, source: 'local' as const },
  );
}

export const PromptStorage = {
  // ── Prompts ────────────────────────────────────────────────────────────

  async getAll(): Promise<Prompt[]> {
    const raw = await promptsRepo.getAll();
    return migratePrompts(raw);
  },

  async save(prompt: Prompt): Promise<void> {
    await guardAction();
    await promptsRepo.save(prompt);
    void trackAction();
  },

  async update(id: string, updates: Partial<Prompt>): Promise<void> {
    await guardAction();
    await promptsRepo.update(id, { ...updates, updatedAt: new Date().toISOString() } as Partial<Prompt>);
    void trackAction();
  },

  async delete(id: string): Promise<void> {
    await guardAction();
    const existing = await promptsRepo.getById(id);
    if (existing && existing.source === 'app') {
      await promptsRepo.delete(id);
    } else if (existing) {
      await promptsRepo.markDeleted(id);
    }
    void trackAction();
  },

  async deleteAll(): Promise<void> {
    const all = await promptsRepo.getAll();
    for (const p of all) {
      if (p.source === 'app') {
        await promptsRepo.delete(p.id);
      } else {
        await promptsRepo.markDeleted(p.id);
      }
    }
  },

  async trackUsage(id: string): Promise<void> {
    const existing = await promptsRepo.getById(id);
    if (existing) {
      await promptsRepo.save({
        ...existing,
        usageCount: existing.usageCount + 1,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  },

  // ── Folders ────────────────────────────────────────────────────────────

  async getFolders(): Promise<PromptFolder[]> {
    const all = await foldersRepo.getAll();
    // Migration: add source field based on id prefix (af-* → app, others → local)
    return all.map((f) =>
      f.source ? f : { ...f, source: f.id.startsWith('af-') ? 'app' as const : 'local' as const },
    );
  },

  async saveFolder(folder: PromptFolder): Promise<void> {
    await guardAction();
    await foldersRepo.save(folder);
    void trackAction();
  },

  async deleteFolder(id: string): Promise<void> {
    await guardAction();
    // Delete folder and move its child prompts to parent (or root).
    // Use per-record update()/markDeleted() so tombstones on siblings are
    // preserved — replaceAll() would silently drop them.
    const [folders, prompts] = await Promise.all([
      foldersRepo.getAll(),
      promptsRepo.getAll(),
    ]);
    const folder = folders.find((f) => f.id === id);

    // Re-parent child folders to the deleted folder's parent.
    for (const child of folders) {
      if (child.id !== id && child.parentId === id) {
        await foldersRepo.update(child.id, { parentId: folder?.parentId });
      }
    }
    // Clear folderId on prompts inside this folder.
    for (const p of prompts) {
      if (p.folderId === id) {
        await promptsRepo.update(p.id, { folderId: undefined });
      }
    }
    // App-source folders have no remote counterpart — hard-delete locally.
    if (folder && folder.source === 'app') {
      await foldersRepo.delete(id);
    } else if (folder) {
      await foldersRepo.markDeleted(id);
    }
    void trackAction();
  },

  // ── Categories ──────────────────────────────────────────────────────────

  getCategories(): Promise<PromptCategory[]> {
    return categoriesAdapter.getAll();
  },

  async saveCategory(category: PromptCategory): Promise<void> {
    return withStorageLock('prompt_categories', async () => {
      const all = await categoriesAdapter.getAll();
      const idx = all.findIndex((c) => c.id === category.id);
      if (idx >= 0) {
        all[idx] = category;
      } else {
        all.push(category);
      }
      await categoriesAdapter.setAll(all);
    });
  },

  async deleteCategory(id: string): Promise<void> {
    return withStorageLock('prompt_categories', async () => {
      const all = await categoriesAdapter.getAll();
      await categoriesAdapter.setAll(all.filter((c) => c.id !== id));
    });
  },

  // ── Tags ────────────────────────────────────────────────────────────────

  getTags(): Promise<PromptTag[]> {
    return tagsAdapter.getAll();
  },

  async saveTag(tag: PromptTag): Promise<void> {
    return withStorageLock('prompt_tags', async () => {
      const all = await tagsAdapter.getAll();
      const idx = all.findIndex((t) => t.id === tag.id);
      if (idx >= 0) {
        all[idx] = tag;
      } else {
        all.push(tag);
      }
      await tagsAdapter.setAll(all);
    });
  },

  async deleteTag(id: string): Promise<void> {
    return withStorageLock('prompt_tags', async () => {
      const all = await tagsAdapter.getAll();
      await tagsAdapter.setAll(all.filter((t) => t.id !== id));
    });
  },

  // ── Bulk helpers (used by import service) ─────────────────────────────

  setFolders: (folders: PromptFolder[]): Promise<void> => foldersRepo.replaceAll(folders),
  setCategories: (categories: PromptCategory[]): Promise<void> => categoriesAdapter.setAll(categories),
  setTags: (tags: PromptTag[]): Promise<void> => tagsAdapter.setAll(tags),

  async mergeFolders(incoming: PromptFolder[]): Promise<void> {
    await foldersRepo.importMany(incoming);
  },

  async mergeCategories(incoming: PromptCategory[]): Promise<void> {
    return withStorageLock('prompt_categories', async () => {
      const existing = await categoriesAdapter.getAll();
      const map = new Map(existing.map((c) => [c.id, c]));
      incoming.forEach((c) => map.set(c.id, c));
      await categoriesAdapter.setAll(Array.from(map.values()));
    });
  },

  async mergeTags(incoming: PromptTag[]): Promise<void> {
    return withStorageLock('prompt_tags', async () => {
      const existing = await tagsAdapter.getAll();
      const map = new Map(existing.map((t) => [t.id, t]));
      incoming.forEach((t) => map.set(t.id, t));
      await tagsAdapter.setAll(Array.from(map.values()));
    });
  },

  // ── App Folders Seed ───────────────────────────────────────────────────

  async seedAppFolders(): Promise<void> {
    const now = new Date().toISOString();
    const f = (id: string, name: string, parentId: string | undefined, pos: number, color?: string): PromptFolder => ({
      id, name, parentId, position: pos, createdAt: now,
      source: id.startsWith('af-') ? 'app' : 'local',
      ...(color ? { color } : {}),
    });

    const folders: PromptFolder[] = [
      // ── Root ──────────────────────────────────────────────────────────────
      f('af-coding',      'Coding',        undefined, 0, '#3b82f6'),
      f('af-ai',          'AI',            undefined, 1, '#f59e0b'),
      f('af-writing',     'Writing',       undefined, 2, '#8b5cf6'),
      f('af-business',    'Business',      undefined, 3, '#10b981'),
      f('af-personal',    'Personal',      undefined, 4, '#ec4899'),
      f('af-system',      'System',        undefined, 5, '#6b7280'),
      f('af-exp',         'Experimental',  undefined, 6, '#f97316'),

      // ── Coding (L2) ───────────────────────────────────────────────────────
      f('af-c-review',   'Review',         'af-coding', 0),
      f('af-c-testing',  'Testing',        'af-coding', 1),
      f('af-c-debug',    'Debugging',      'af-coding', 2),
      f('af-c-refactor', 'Refactoring',    'af-coding', 3),
      f('af-c-impl',     'Implementation', 'af-coding', 4),
      f('af-c-arch',     'Architecture',   'af-coding', 5),
      f('af-c-devops',   'DevOps',         'af-coding', 6),
      f('af-c-docs',     'Documentation',  'af-coding', 7),

      // Coding > Review
      f('af-c-rv-full',  'Full Project',   'af-c-review', 0),
      f('af-c-rv-mod',   'Module',         'af-c-review', 1),
      f('af-c-rv-file',  'File',           'af-c-review', 2),
      f('af-c-rv-perf',  'Performance',    'af-c-review', 3),
      f('af-c-rv-sec',   'Security',       'af-c-review', 4),
      f('af-c-rv-best',  'Best Practices', 'af-c-review', 5),
      f('af-c-rv-arch',  'Architecture',   'af-c-review', 6),

      // Coding > Testing
      f('af-c-ts-unit',  'Unit',           'af-c-testing', 0),
      f('af-c-ts-int',   'Integration',    'af-c-testing', 1),
      f('af-c-ts-e2e',   'E2E',            'af-c-testing', 2),
      f('af-c-ts-api',   'API',            'af-c-testing', 3),
      f('af-c-ts-ui',    'UI',             'af-c-testing', 4),
      f('af-c-ts-perf',  'Performance',    'af-c-testing', 5),
      f('af-c-ts-edge',  'Edge Cases',     'af-c-testing', 6),

      // Coding > Debugging
      f('af-c-dbg-err',  'Error Analysis', 'af-c-debug', 0),
      f('af-c-dbg-root', 'Root Cause',     'af-c-debug', 1),
      f('af-c-dbg-fix',  'Fix',            'af-c-debug', 2),
      f('af-c-dbg-logs', 'Logs Analysis',  'af-c-debug', 3),
      f('af-c-dbg-crsh', 'Crash',          'af-c-debug', 4),
      f('af-c-dbg-mem',  'Memory Leak',    'af-c-debug', 5),
      f('af-c-dbg-asyn', 'Async Issues',   'af-c-debug', 6),

      // Coding > Refactoring
      f('af-c-rf-cln',   'Clean Code',          'af-c-refactor', 0),
      f('af-c-rf-simp',  'Simplify',            'af-c-refactor', 1),
      f('af-c-rf-dedup', 'Remove Duplication',  'af-c-refactor', 2),
      f('af-c-rf-read',  'Improve Readability', 'af-c-refactor', 3),
      f('af-c-rf-perf',  'Performance',         'af-c-refactor', 4),
      f('af-c-rf-str',   'Structure',           'af-c-refactor', 5),

      // Coding > Implementation
      f('af-c-im-feat',  'Feature',   'af-c-impl', 0),
      f('af-c-im-api',   'API',       'af-c-impl', 1),
      f('af-c-im-db',    'Database',  'af-c-impl', 2),
      f('af-c-im-ui',    'UI',        'af-c-impl', 3),

      // Coding > Implementation > Feature
      f('af-c-im-ft-s',  'Simple',   'af-c-im-feat', 0),
      f('af-c-im-ft-c',  'Complex',  'af-c-im-feat', 1),
      f('af-c-im-ft-sc', 'Scalable', 'af-c-im-feat', 2),

      // Coding > Implementation > API
      f('af-c-im-ap-r',  'REST',       'af-c-im-api', 0),
      f('af-c-im-ap-g',  'GraphQL',    'af-c-im-api', 1),
      f('af-c-im-ap-v',  'Validation', 'af-c-im-api', 2),

      // Coding > Implementation > Database
      f('af-c-im-db-s',  'Schema',       'af-c-im-db', 0),
      f('af-c-im-db-q',  'Queries',      'af-c-im-db', 1),
      f('af-c-im-db-o',  'Optimization', 'af-c-im-db', 2),
      f('af-c-im-db-m',  'Migration',    'af-c-im-db', 3),

      // Coding > Implementation > UI
      f('af-c-im-ui-co', 'Components', 'af-c-im-ui', 0),
      f('af-c-im-ui-fo', 'Forms',      'af-c-im-ui', 1),
      f('af-c-im-ui-ta', 'Tables',     'af-c-im-ui', 2),
      f('af-c-im-ui-da', 'Dashboards', 'af-c-im-ui', 3),

      // Coding > Architecture
      f('af-c-ar-sys',   'System Design',    'af-c-arch', 0),
      f('af-c-ar-micro', 'Microservices',    'af-c-arch', 1),
      f('af-c-ar-mono',  'Monolith',         'af-c-arch', 2),
      f('af-c-ar-fold',  'Folder Structure', 'af-c-arch', 3),
      f('af-c-ar-scal',  'Scalability',      'af-c-arch', 4),
      f('af-c-ar-pat',   'Design Patterns',  'af-c-arch', 5),

      // Coding > Architecture > Design Patterns
      f('af-c-ar-pt-cr', 'Creational', 'af-c-ar-pat', 0),
      f('af-c-ar-pt-st', 'Structural', 'af-c-ar-pat', 1),
      f('af-c-ar-pt-bh', 'Behavioral', 'af-c-ar-pat', 2),

      // Coding > DevOps
      f('af-c-dv-cicd',  'CI/CD',      'af-c-devops', 0),
      f('af-c-dv-dock',  'Docker',     'af-c-devops', 1),
      f('af-c-dv-k8s',   'Kubernetes', 'af-c-devops', 2),
      f('af-c-dv-dep',   'Deployment', 'af-c-devops', 3),
      f('af-c-dv-mon',   'Monitoring', 'af-c-devops', 4),
      f('af-c-dv-log',   'Logging',    'af-c-devops', 5),

      // Coding > Documentation
      f('af-c-dc-api',   'API Doc',       'af-c-docs', 0),
      f('af-c-dc-tech',  'Technical Doc', 'af-c-docs', 1),
      f('af-c-dc-rdme',  'README',        'af-c-docs', 2),
      f('af-c-dc-chg',   'Changelog',     'af-c-docs', 3),
      f('af-c-dc-cmt',   'Code Comments', 'af-c-docs', 4),

      // ── AI (L2) ───────────────────────────────────────────────────────────
      f('af-ai-pe',      'Prompt Engineering', 'af-ai', 0),
      f('af-ai-code',    'AI Code',            'af-ai', 1),
      f('af-ai-auto',    'Automation',         'af-ai', 2),
      f('af-ai-data',    'Data',               'af-ai', 3),

      // AI > Prompt Engineering
      f('af-ai-pe-cre',  'Create',     'af-ai-pe', 0),
      f('af-ai-pe-imp',  'Improve',    'af-ai-pe', 1),
      f('af-ai-pe-opt',  'Optimize',   'af-ai-pe', 2),
      f('af-ai-pe-dbg',  'Debug',      'af-ai-pe', 3),
      f('af-ai-pe-str',  'Structure',  'af-ai-pe', 4),
      f('af-ai-pe-eval', 'Evaluation', 'af-ai-pe', 5),

      // AI > AI Code
      f('af-ai-co-gen',  'Generate', 'af-ai-code', 0),
      f('af-ai-co-rev',  'Review',   'af-ai-code', 1),
      f('af-ai-co-fix',  'Fix',      'af-ai-code', 2),
      f('af-ai-co-opt',  'Optimize', 'af-ai-code', 3),
      f('af-ai-co-exp',  'Explain',  'af-ai-code', 4),

      // AI > Automation
      f('af-ai-au-wf',   'Workflows',    'af-ai-auto', 0),
      f('af-ai-au-ms',   'Multi-Step',   'af-ai-auto', 1),
      f('af-ai-au-ag',   'Agents',       'af-ai-auto', 2),
      f('af-ai-au-int',  'Integrations', 'af-ai-auto', 3),

      // AI > Data
      f('af-ai-da-ana',  'Analysis',       'af-ai-data', 0),
      f('af-ai-da-cln',  'Cleaning',       'af-ai-data', 1),
      f('af-ai-da-trn',  'Transformation', 'af-ai-data', 2),
      f('af-ai-da-vis',  'Visualization',  'af-ai-data', 3),

      // ── Writing (L2) ──────────────────────────────────────────────────────
      f('af-wr-email',   'Emails',         'af-writing', 0),
      f('af-wr-content', 'Content',        'af-writing', 1),
      f('af-wr-docs',    'Documentation',  'af-writing', 2),
      f('af-wr-trans',   'Translation',    'af-writing', 3),
      f('af-wr-sum',     'Summarization',  'af-writing', 4),

      // Writing > Emails
      f('af-wr-em-for',  'Formal',    'af-wr-email', 0),
      f('af-wr-em-inf',  'Informal',  'af-wr-email', 1),
      f('af-wr-em-fol',  'Follow-up', 'af-wr-email', 2),
      f('af-wr-em-sup',  'Support',   'af-wr-email', 3),
      f('af-wr-em-cmp',  'Complaint', 'af-wr-email', 4),
      f('af-wr-em-job',  'Job',       'af-wr-email', 5),

      // Writing > Content
      f('af-wr-ct-blog', 'Blog',         'af-wr-content', 0),
      f('af-wr-ct-li',   'LinkedIn',     'af-wr-content', 1),
      f('af-wr-ct-tw',   'Twitter',      'af-wr-content', 2),
      f('af-wr-ct-mkt',  'Marketing',    'af-wr-content', 3),
      f('af-wr-ct-sty',  'Storytelling', 'af-wr-content', 4),

      // Writing > Documentation
      f('af-wr-dc-proj', 'Project',   'af-wr-docs', 0),
      f('af-wr-dc-api',  'API',       'af-wr-docs', 1),
      f('af-wr-dc-gui',  'Guides',    'af-wr-docs', 2),
      f('af-wr-dc-tut',  'Tutorials', 'af-wr-docs', 3),

      // Writing > Translation
      f('af-wr-tr-gen',  'General',   'af-wr-trans', 0),
      f('af-wr-tr-tech', 'Technical', 'af-wr-trans', 1),
      f('af-wr-tr-leg',  'Legal',     'af-wr-trans', 2),
      f('af-wr-tr-mkt',  'Marketing', 'af-wr-trans', 3),

      // Writing > Summarization
      f('af-wr-su-sht',  'Short',         'af-wr-sum', 0),
      f('af-wr-su-det',  'Detailed',      'af-wr-sum', 1),
      f('af-wr-su-bul',  'Bullet Points', 'af-wr-sum', 2),

      // ── Business (L2) ─────────────────────────────────────────────────────
      f('af-biz-prod',   'Product',   'af-business', 0),
      f('af-biz-mkt',    'Marketing', 'af-business', 1),
      f('af-biz-sales',  'Sales',     'af-business', 2),
      f('af-biz-ana',    'Analytics', 'af-business', 3),

      // Business > Product
      f('af-biz-pr-id',  'Ideas',         'af-biz-prod', 0),
      f('af-biz-pr-ft',  'Features',      'af-biz-prod', 1),
      f('af-biz-pr-rd',  'Roadmap',       'af-biz-prod', 2),
      f('af-biz-pr-us',  'User Stories',  'af-biz-prod', 3),
      f('af-biz-pr-req', 'Requirements',  'af-biz-prod', 4),

      // Business > Marketing
      f('af-biz-mk-cmp', 'Campaigns', 'af-biz-mkt', 0),
      f('af-biz-mk-ads', 'Ads',       'af-biz-mkt', 1),
      f('af-biz-mk-seo', 'SEO',       'af-biz-mkt', 2),
      f('af-biz-mk-brd', 'Branding',  'af-biz-mkt', 3),
      f('af-biz-mk-str', 'Strategy',  'af-biz-mkt', 4),

      // Business > Sales
      f('af-biz-sl-pit', 'Pitch',         'af-biz-sales', 0),
      f('af-biz-sl-cld', 'Cold Outreach', 'af-biz-sales', 1),
      f('af-biz-sl-prp', 'Proposals',     'af-biz-sales', 2),
      f('af-biz-sl-neg', 'Negotiation',   'af-biz-sales', 3),
      f('af-biz-sl-cls', 'Closing',       'af-biz-sales', 4),

      // Business > Analytics
      f('af-biz-an-met', 'Metrics',    'af-biz-ana', 0),
      f('af-biz-an-rep', 'Reports',    'af-biz-ana', 1),
      f('af-biz-an-dsh', 'Dashboards', 'af-biz-ana', 2),

      // ── Personal (L2) ─────────────────────────────────────────────────────
      f('af-per-learn',  'Learning',     'af-personal', 0),
      f('af-per-prod',   'Productivity', 'af-personal', 1),
      f('af-per-career', 'Career',       'af-personal', 2),
      f('af-per-notes',  'Notes',        'af-personal', 3),

      // Personal > Learning
      f('af-per-le-exp', 'Explain',   'af-per-learn', 0),
      f('af-per-le-pln', 'Plan',      'af-per-learn', 1),
      f('af-per-le-ex',  'Exercises', 'af-per-learn', 2),
      f('af-per-le-qz',  'Quizzes',   'af-per-learn', 3),

      // Personal > Productivity
      f('af-per-pr-day', 'Daily',  'af-per-prod', 0),
      f('af-per-pr-wk',  'Weekly', 'af-per-prod', 1),
      f('af-per-pr-gl',  'Goals',  'af-per-prod', 2),
      f('af-per-pr-hb',  'Habits', 'af-per-prod', 3),

      // Personal > Career
      f('af-per-ca-cv',  'CV',           'af-per-career', 0),
      f('af-per-ca-cov', 'Cover Letter', 'af-per-career', 1),
      f('af-per-ca-int', 'Interview',    'af-per-career', 2),
      f('af-per-ca-li',  'LinkedIn',     'af-per-career', 3),

      // Personal > Notes
      f('af-per-no-qk',  'Quick',      'af-per-notes', 0),
      f('af-per-no-str', 'Structured', 'af-per-notes', 1),
      f('af-per-no-id',  'Ideas',      'af-per-notes', 2),

      // ── System (L2) ───────────────────────────────────────────────────────
      f('af-sys-roles',  'Roles',            'af-system', 0),
      f('af-sys-sp',     'System Prompts',   'af-system', 1),
      f('af-sys-inst',   'Instructions',     'af-system', 2),

      // System > Roles
      f('af-sys-ro-dev', 'Developer', 'af-sys-roles', 0),
      f('af-sys-ro-arc', 'Architect', 'af-sys-roles', 1),
      f('af-sys-ro-rev', 'Reviewer',  'af-sys-roles', 2),
      f('af-sys-ro-tst', 'Tester',    'af-sys-roles', 3),
      f('af-sys-ro-mgr', 'Manager',   'af-sys-roles', 4),

      // System > System Prompts
      f('af-sys-sp-str', 'Strict',     'af-sys-sp', 0),
      f('af-sys-sp-cre', 'Creative',   'af-sys-sp', 1),
      f('af-sys-sp-ana', 'Analytical', 'af-sys-sp', 2),
      f('af-sys-sp-ass', 'Assistant',  'af-sys-sp', 3),

      // System > Instructions
      f('af-sys-in-fmt', 'Formatting',  'af-sys-inst', 0),
      f('af-sys-in-con', 'Constraints', 'af-sys-inst', 1),
      f('af-sys-in-rul', 'Rules',       'af-sys-inst', 2),

      // ── Experimental (L2 — leaves) ────────────────────────────────────────
      f('af-exp-ideas',  'Ideas',      'af-exp', 0),
      f('af-exp-drafts', 'Drafts',     'af-exp', 1),
      f('af-exp-play',   'Playground', 'af-exp', 2),
      f('af-exp-arch',   'Archive',    'af-exp', 3),

      // ── My Prompts defaults (non-af prefix → My Prompts only) ─────────────
      f('mf-work',     'Work',     undefined, 0),
      f('mf-personal', 'Personal', undefined, 1),
    ];

    // Only insert folders that don't already exist
    const existing = await foldersRepo.getAll();
    const existingIds = new Set(existing.map((folder) => folder.id));
    const toAdd = folders.filter((folder) => !existingIds.has(folder.id));
    if (toAdd.length > 0) {
      await foldersRepo.importMany(toAdd);
    }
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

    // Prompts — local ones go in mf-work, app ones in appropriate af-* folders
    const prompts: Prompt[] = [
      {
        id: 'demo-p-1', title: 'Blog Post Introduction',
        content: 'Write a compelling blog post introduction about {{topic}} for {{audience}}. Start with a surprising fact or question, then explain why this topic matters in 2025.',
        description: 'Hook readers in the first paragraph',
        categoryId: 'demo-cat-writing', folderId: 'mf-personal', source: 'local',
        tags: ['demo-tag-creative', 'demo-tag-template'],
        isFavorite: true, isPinned: false, usageCount: 12,
        lastUsedAt: d(1), createdAt: d(10), updatedAt: d(1),
      },
      {
        id: 'demo-p-2', title: 'Professional Email',
        content: 'Write a professional email to {{recipient}} about {{subject}}. Keep it concise and polite. End with a clear call to action and next steps.',
        description: 'Quick professional email template',
        categoryId: 'demo-cat-writing', folderId: 'mf-work', source: 'local',
        tags: ['demo-tag-quick', 'demo-tag-template'],
        isFavorite: false, isPinned: true, usageCount: 34,
        lastUsedAt: d(0), createdAt: d(20), updatedAt: d(0),
      },
      {
        id: 'demo-p-3', title: 'LinkedIn Thought Leadership',
        content: 'Create an engaging LinkedIn post about {{achievement_or_insight}}. Structure: 1) attention-grabbing hook, 2) personal story or data, 3) three key takeaways, 4) question to drive comments. Tone: {{tone}}.',
        description: 'Drive engagement on LinkedIn',
        categoryId: 'demo-cat-marketing', folderId: 'mf-personal', source: 'local',
        tags: ['demo-tag-creative'],
        isFavorite: false, isPinned: false, usageCount: 7,
        lastUsedAt: d(3), createdAt: d(15), updatedAt: d(3),
      },
      {
        id: 'demo-p-4', title: 'Code Review Feedback',
        content: 'Review this {{language}} code for:\n1. Bugs and edge cases\n2. Performance bottlenecks\n3. Security vulnerabilities\n4. Readability and naming conventions\n\nProvide specific line-by-line feedback.\n\n```\n{{code}}\n```',
        description: 'Thorough code review template',
        categoryId: 'demo-cat-coding', folderId: 'mf-work', source: 'local',
        tags: ['demo-tag-technical', 'demo-tag-template'],
        isFavorite: true, isPinned: true, usageCount: 28,
        lastUsedAt: d(0), createdAt: d(30), updatedAt: d(0),
      },
      {
        id: 'demo-p-5', title: 'Unit Test Generator',
        content: 'Generate comprehensive unit tests for this {{language}} function using {{test_framework}}.\n\nCover: happy path, edge cases, error conditions, and boundary values. Include mocks where needed.\n\n```\n{{function_code}}\n```',
        description: 'Generate full test coverage',
        categoryId: 'demo-cat-coding', folderId: 'mf-work', source: 'local',
        tags: ['demo-tag-technical'],
        isFavorite: false, isPinned: false, usageCount: 15,
        lastUsedAt: d(2), createdAt: d(25), updatedAt: d(2),
      },
      {
        id: 'demo-p-6', title: 'SQL Query Optimizer',
        content: 'Write an optimized SQL query to {{task_description}}.\n\nInclude:\n- Efficient JOINs and WHERE clauses\n- Index recommendations\n- Query explanation\n- Alternative approach if applicable\n\nSchema context: {{schema}}',
        categoryId: 'demo-cat-coding', folderId: 'mf-work', source: 'local',
        tags: ['demo-tag-technical'],
        isFavorite: false, isPinned: false, usageCount: 9,
        lastUsedAt: d(5), createdAt: d(18), updatedAt: d(5),
      },
      {
        id: 'demo-p-7', title: 'Meeting Notes Summary',
        content: 'Summarize this meeting transcript into:\n- **Attendees**: list of participants\n- **Key Decisions**: bullet points\n- **Action Items**: owner, task, deadline\n- **Open Questions**: unresolved items\n\nTranscript:\n{{transcript}}',
        description: 'Turn raw meeting notes into structured summary',
        categoryId: 'demo-cat-writing', folderId: 'mf-work', source: 'local',
        tags: ['demo-tag-quick'],
        isFavorite: false, isPinned: false, usageCount: 22,
        lastUsedAt: d(1), createdAt: d(12), updatedAt: d(1),
      },
      {
        id: 'demo-p-8', title: 'Custom AI Persona',
        content: 'You are {{persona_name}}, an expert in {{domain}}. You communicate in a {{communication_style}} tone and always provide {{output_format}} responses. Your goal is to help users with {{primary_goal}}. Never {{constraint}}.',
        description: 'Define a custom GPT system prompt',
        categoryId: 'demo-cat-ai', folderId: 'af-sys-sp', source: 'app',
        tags: ['demo-tag-template'],
        isFavorite: true, isPinned: false, usageCount: 18,
        lastUsedAt: d(2), createdAt: d(8), updatedAt: d(2),
      },
      {
        id: 'demo-p-9', title: 'Image Generation Prompt',
        content: '{{style}} illustration of {{subject}}. Lighting: {{lighting}}. Color palette: {{colors}}. Mood: {{mood}}. Artistic style inspired by {{artist_reference}}. High resolution, detailed, cinematic composition.',
        description: 'Structured prompt for AI image tools',
        categoryId: 'demo-cat-ai', folderId: 'af-ai-pe', source: 'app',
        tags: ['demo-tag-creative', 'demo-tag-template'],
        isFavorite: false, isPinned: true, usageCount: 41,
        lastUsedAt: d(0), createdAt: d(6), updatedAt: d(0),
      },
      {
        id: 'demo-p-10', title: 'Data Analysis Assistant',
        content: 'Analyze this dataset and provide:\n1. Key statistical insights (mean, median, outliers)\n2. Notable patterns or anomalies\n3. Actionable business recommendations\n4. Suggested chart types for visualization\n\nData:\n{{data_or_description}}',
        categoryId: 'demo-cat-ai', folderId: 'af-ai-da-ana', source: 'app',
        tags: ['demo-tag-technical'],
        isFavorite: false, isPinned: false, usageCount: 6,
        lastUsedAt: d(4), createdAt: d(14), updatedAt: d(4),
      },
      {
        id: 'demo-p-11', title: 'Product Description Writer',
        content: 'Write a compelling product description for {{product_name}}.\n\nTarget audience: {{target_audience}}\nKey features: {{features}}\nTone: {{tone}} (e.g. professional, playful, luxurious)\nLength: {{word_count}} words\n\nInclude: headline, 2–3 benefit statements, and a call to action.',
        description: 'E-commerce ready product copy',
        categoryId: 'demo-cat-marketing', folderId: 'af-wr-ct-mkt', source: 'app',
        tags: ['demo-tag-creative', 'demo-tag-template'],
        isFavorite: false, isPinned: false, usageCount: 11,
        lastUsedAt: d(3), createdAt: d(9), updatedAt: d(3),
      },
    ];

    // Merge with existing data (skip IDs that already exist)
    const [existingCats, existingTags] = await Promise.all([
      categoriesAdapter.getAll(),
      tagsAdapter.getAll(),
    ]);

    const existingCatIds = new Set(existingCats.map((c) => c.id));
    const existingTagIds = new Set(existingTags.map((t) => t.id));

    await Promise.all([
      promptsRepo.importMany(prompts),
      categoriesAdapter.setAll([
        ...existingCats,
        ...cats.filter((c) => !existingCatIds.has(c.id)),
      ]),
      tagsAdapter.setAll([
        ...existingTags,
        ...tags.filter((t) => !existingTagIds.has(t.id)),
      ]),
    ]);
  },
};
