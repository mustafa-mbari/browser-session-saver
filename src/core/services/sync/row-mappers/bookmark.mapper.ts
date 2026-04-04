import type { BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';
import type { RowMapper } from '@core/types/base.types';

/**
 * BookmarkCategory mapper. Note: the Supabase table is `bookmark_folders`
 * (not `bookmark_categories`) for historical reasons.
 *
 * `fromRow` requires additional parameters (bookmarkIds, fallbackDate)
 * that cannot be provided by the generic RowMapper interface, so this
 * mapper provides `fromRow` for the common case and a separate
 * `fromRowWithContext` for the full reconstruction.
 */
export const bookmarkCategoryMapper: RowMapper<BookmarkCategory> = {
  toRow(c: BookmarkCategory, userId: string): Record<string, unknown> {
    return {
      id: c.id,
      user_id: userId,
      board_id: c.boardId,
      name: c.name,
      icon: c.icon ?? null,
      color: c.color ?? null,
      card_type: c.cardType ?? 'bookmark',
      note_content: c.noteContent ?? null,
      col_span: c.colSpan ?? 3,
      row_span: c.rowSpan ?? 3,
      position: 0,
      parent_folder_id: c.parentCategoryId ?? null,
    };
  },

  fromRow(r: Record<string, unknown>): BookmarkCategory {
    return bookmarkCategoryFromRowWithContext(r, [], new Date().toISOString());
  },
};

/**
 * Full reconstruction of a BookmarkCategory from a Supabase row,
 * including bookmarkIds and a fallback date for createdAt.
 */
export function bookmarkCategoryFromRowWithContext(
  r: Record<string, unknown>,
  bookmarkIds: string[],
  fallbackDate: string,
): BookmarkCategory {
  return {
    id: r.id as string,
    boardId: (r.board_id ?? '') as string,
    name: r.name as string,
    icon: (r.icon ?? '') as string,
    color: (r.color ?? '') as string,
    bookmarkIds,
    collapsed: false,
    colSpan: (r.col_span ?? 3) as BookmarkCategory['colSpan'],
    rowSpan: (r.row_span ?? 3) as BookmarkCategory['rowSpan'],
    cardType: (r.card_type ?? 'bookmark') as BookmarkCategory['cardType'],
    noteContent: (r.note_content ?? undefined) as string | undefined,
    parentCategoryId: (r.parent_folder_id ?? undefined) as string | undefined,
    createdAt: fallbackDate,
  };
}

/**
 * BookmarkEntry uses `addedAt` instead of `createdAt`, so it does not
 * conform to Syncable directly. We cast to satisfy the RowMapper generic
 * since the mapper only needs toRow/fromRow — it doesn't rely on createdAt.
 */
export const bookmarkEntryMapper = {
  toRow(e: BookmarkEntry, userId: string): Record<string, unknown> {
    return {
      id: e.id,
      user_id: userId,
      folder_id: e.categoryId,
      title: e.title,
      url: e.url,
      fav_icon_url: e.favIconUrl ?? null,
      description: e.description ?? null,
      category: e.category ?? null,
      is_native: e.isNative ?? false,
      native_id: e.nativeId ?? null,
      position: 0,
    };
  },

  fromRow(r: Record<string, unknown>): BookmarkEntry {
    return bookmarkEntryFromRowWithContext(r, new Date().toISOString());
  },
};

/**
 * Full reconstruction of a BookmarkEntry from a Supabase row,
 * with a fallback date for addedAt.
 */
export function bookmarkEntryFromRowWithContext(
  r: Record<string, unknown>,
  fallbackDate: string,
): BookmarkEntry {
  return {
    id: r.id as string,
    categoryId: r.folder_id as string,
    title: r.title as string,
    url: r.url as string,
    favIconUrl: (r.fav_icon_url ?? '') as string,
    addedAt: fallbackDate,
    isNative: (r.is_native ?? false) as boolean,
    nativeId: (r.native_id ?? undefined) as string | undefined,
    category: (r.category ?? undefined) as string | undefined,
    description: (r.description ?? undefined) as string | undefined,
  };
}
