import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import {
  BookmarkBoardContext,
  useBookmarkBoardActions,
} from '@newtab/contexts/BookmarkBoardContext';
import type { BookmarkBoardActions } from '@newtab/contexts/BookmarkBoardContext';

const mockActions: BookmarkBoardActions = {
  onAddEntry: vi.fn(),
  onDeleteEntry: vi.fn(),
  onRenameEntry: vi.fn(),
  onDeleteCategory: vi.fn(),
  onToggleCollapse: vi.fn(),
  onReorderEntries: vi.fn(),
  onResize: vi.fn(),
  onRenameCard: vi.fn(),
  onDuplicateCard: vi.fn(),
};

describe('useBookmarkBoardActions', () => {
  it('throws with a descriptive message when used outside the provider', () => {
    expect(() => renderHook(() => useBookmarkBoardActions())).toThrow(
      'useBookmarkBoardActions must be used inside BookmarkBoard',
    );
  });

  it('returns the context value when rendered inside the provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(BookmarkBoardContext.Provider, { value: mockActions }, children);

    const { result } = renderHook(() => useBookmarkBoardActions(), { wrapper });

    expect(result.current.onAddEntry).toBe(mockActions.onAddEntry);
    expect(result.current.onDeleteEntry).toBe(mockActions.onDeleteEntry);
    expect(result.current.onRenameEntry).toBe(mockActions.onRenameEntry);
    expect(result.current.onDeleteCategory).toBe(mockActions.onDeleteCategory);
    expect(result.current.onToggleCollapse).toBe(mockActions.onToggleCollapse);
    expect(result.current.onReorderEntries).toBe(mockActions.onReorderEntries);
    expect(result.current.onResize).toBe(mockActions.onResize);
    expect(result.current.onRenameCard).toBe(mockActions.onRenameCard);
    expect(result.current.onDuplicateCard).toBe(mockActions.onDuplicateCard);
  });

  it('onUpdateNote is optional and defaults to undefined when not provided', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(BookmarkBoardContext.Provider, { value: mockActions }, children);

    const { result } = renderHook(() => useBookmarkBoardActions(), { wrapper });
    expect(result.current.onUpdateNote).toBeUndefined();
  });

  it('exposes onUpdateNote when explicitly provided', () => {
    const onUpdateNote = vi.fn();
    const actionsWithNote: BookmarkBoardActions = { ...mockActions, onUpdateNote };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(BookmarkBoardContext.Provider, { value: actionsWithNote }, children);

    const { result } = renderHook(() => useBookmarkBoardActions(), { wrapper });
    expect(result.current.onUpdateNote).toBe(onUpdateNote);
  });
});
