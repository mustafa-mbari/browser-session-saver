export interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  categoryId?: string;
  folderId?: string;           // folder assignment
  source: 'local' | 'app';   // origin: user-created or from external app
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  usageCount: number;
  lastUsedAt?: string;         // ISO timestamp
  createdAt: string;
  updatedAt: string;
  compatibleModels?: string[]; // e.g. ['GPT-4o', 'Claude 3.5']
  // user_id: reserved for future Supabase integration
}

export interface PromptFolder {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  source: 'local' | 'app';   // which section this folder belongs to
  parentId?: string;           // parent folder id for nesting
  position: number;            // sort order among siblings
  createdAt: string;
}

export interface PromptCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

export interface PromptTag {
  id: string;
  name: string;
  color: string;
}

export type PromptSortField = 'title' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt';

export type PromptSectionKey = 'start' | 'quick-access' | 'all' | 'favorites' | 'local' | 'app';

export interface PromptFilterOptions {
  search?: string;
  categoryId?: string;
  tagIds?: string[];
  favoritesOnly?: boolean;
  pinnedOnly?: boolean;
  folderId?: string;
  source?: 'local' | 'app';
}

/**
 * Navigation state for the Prompt Manager sidebar.
 * - 'section' → one of the top utility views (Start Page, Quick Access, All, Favorites)
 * - 'source'  → a source-scoped view (My Prompts / App Prompts) optionally narrowed to a folder
 */
export type PromptsNavState =
  | { kind: 'section'; key: PromptSectionKey }
  | { kind: 'source'; source: 'local' | 'app'; folderId?: string };
