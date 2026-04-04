import type { Prompt, PromptFolder } from '@core/types/prompt.types';
import type { RowMapper } from '@core/types/base.types';

export const promptMapper: RowMapper<Prompt> = {
  toRow(p: Prompt, userId: string): Record<string, unknown> {
    return {
      id: p.id,
      user_id: userId,
      title: p.title,
      content: p.content,
      description: p.description ?? null,
      category_id: p.categoryId ?? null,
      folder_id: p.folderId ?? null,
      source: p.source,
      tags: p.tags,
      is_favorite: p.isFavorite,
      is_pinned: p.isPinned,
      usage_count: p.usageCount,
      last_used_at: p.lastUsedAt ?? null,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  },

  fromRow(r: Record<string, unknown>): Prompt {
    return {
      id: r.id as string,
      title: r.title as string,
      content: r.content as string,
      description: (r.description ?? undefined) as string | undefined,
      categoryId: (r.category_id ?? undefined) as string | undefined,
      folderId: (r.folder_id ?? undefined) as string | undefined,
      source: (r.source ?? 'local') as Prompt['source'],
      tags: (r.tags ?? []) as string[],
      isFavorite: (r.is_favorite ?? false) as boolean,
      isPinned: (r.is_pinned ?? false) as boolean,
      usageCount: (r.usage_count ?? 0) as number,
      lastUsedAt: (r.last_used_at ?? undefined) as string | undefined,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  },
};

export const promptFolderMapper: RowMapper<PromptFolder> = {
  toRow(f: PromptFolder, userId: string): Record<string, unknown> {
    return {
      id: f.id,
      user_id: userId,
      name: f.name,
      icon: f.icon ?? null,
      color: f.color ?? null,
      source: f.source,
      parent_id: f.parentId ?? null,
      position: f.position,
      created_at: f.createdAt,
    };
  },

  fromRow(r: Record<string, unknown>): PromptFolder {
    return {
      id: r.id as string,
      name: r.name as string,
      icon: (r.icon ?? undefined) as string | undefined,
      color: (r.color ?? undefined) as string | undefined,
      source: (r.source ?? 'local') as PromptFolder['source'],
      parentId: (r.parent_id ?? undefined) as string | undefined,
      position: (r.position ?? 0) as number,
      createdAt: r.created_at as string,
    };
  },
};
