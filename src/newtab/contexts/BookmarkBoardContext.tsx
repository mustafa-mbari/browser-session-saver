import { createContext, useContext } from 'react';
import type { SpanValue } from '@core/types/newtab.types';

export interface BookmarkBoardActions {
  onAddEntry: (categoryId: string, title: string, url: string) => void;
  onDeleteEntry: (id: string) => void;
  onRenameEntry: (id: string, title: string, url: string) => void;
  onDeleteCategory: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onReorderEntries: (categoryId: string, orderedIds: string[]) => void;
  onResize: (id: string, colSpan: SpanValue, rowSpan: SpanValue) => void;
  onUpdateNote?: (id: string, content: string) => void;
  onRefreshQuote?: (id: string, quoteIndex: number, quoteChangedAt: string) => void;
  onRenameCard: (id: string, name: string) => void;
  onDuplicateCard: (id: string) => void;
}

export const BookmarkBoardContext = createContext<BookmarkBoardActions | null>(null);

export function useBookmarkBoardActions(): BookmarkBoardActions {
  const ctx = useContext(BookmarkBoardContext);
  if (!ctx) throw new Error('useBookmarkBoardActions must be used inside BookmarkBoard');
  return ctx;
}
