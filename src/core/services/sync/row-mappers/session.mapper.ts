import type { Session } from '@core/types/session.types';
import type { RowMapper } from '@core/types/base.types';

export const sessionMapper: RowMapper<Session> = {
  toRow(s: Session, userId: string): Record<string, unknown> {
    return {
      id: s.id,
      user_id: userId,
      name: s.name,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
      tabs: s.tabs,
      tab_groups: s.tabGroups,
      window_id: s.windowId,
      tags: s.tags,
      is_pinned: s.isPinned,
      is_starred: s.isStarred,
      is_locked: s.isLocked,
      is_auto_save: s.isAutoSave,
      auto_save_trigger: s.autoSaveTrigger,
      notes: s.notes,
      tab_count: s.tabCount,
      version: s.version,
    };
  },

  fromRow(r: Record<string, unknown>): Session {
    return {
      id: r.id as string,
      name: r.name as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      tabs: (r.tabs ?? []) as Session['tabs'],
      tabGroups: (r.tab_groups ?? []) as Session['tabGroups'],
      windowId: (r.window_id ?? 0) as number,
      tags: (r.tags ?? []) as string[],
      isPinned: (r.is_pinned ?? false) as boolean,
      isStarred: (r.is_starred ?? false) as boolean,
      isLocked: (r.is_locked ?? false) as boolean,
      isAutoSave: (r.is_auto_save ?? false) as boolean,
      autoSaveTrigger: (r.auto_save_trigger ?? 'manual') as Session['autoSaveTrigger'],
      notes: (r.notes ?? '') as string,
      tabCount: (r.tab_count ?? 0) as number,
      version: (r.version ?? '1') as string,
    };
  },
};
