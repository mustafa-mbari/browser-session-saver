import { describe, it, expect, vi } from 'vitest';
import { useSortableItems, useSortableCategories } from '@newtab/hooks/useBookmarkDnd';
import type { DragEndEvent } from '@dnd-kit/core';

/** Build a minimal DragEndEvent for testing */
function makeDragEvent(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId, data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    over: overId
      ? { id: overId, data: { current: {} }, rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 } }
      : null,
    activatorEvent: new Event('mousedown'),
    delta: { x: 0, y: 0 },
    collisions: null,
  } as unknown as DragEndEvent;
}

const items = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
];

describe('useSortableItems', () => {
  it('reorders items when dragged from index 0 to index 2', () => {
    const onReorder = vi.fn();
    const { handleDragEnd } = useSortableItems(items, onReorder);

    handleDragEnd(makeDragEvent('a', 'c'));

    expect(onReorder).toHaveBeenCalledWith([
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'a', label: 'A' },
    ]);
  });

  it('is a no-op when dragged onto itself (same active and over id)', () => {
    const onReorder = vi.fn();
    const { handleDragEnd } = useSortableItems(items, onReorder);

    handleDragEnd(makeDragEvent('b', 'b'));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('is a no-op when over is null (dropped outside any droppable)', () => {
    const onReorder = vi.fn();
    const { handleDragEnd } = useSortableItems(items, onReorder);

    handleDragEnd(makeDragEvent('a', null));

    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('useSortableCategories', () => {
  const categories = [
    { id: 'cat1', name: 'Cat 1' },
    { id: 'cat2', name: 'Cat 2' },
    { id: 'cat3', name: 'Cat 3' },
  ];

  it('reorders categories when dragged from index 0 to index 1', () => {
    const onReorder = vi.fn();
    const { handleDragEnd } = useSortableCategories(categories, onReorder);

    handleDragEnd(makeDragEvent('cat1', 'cat2'));

    expect(onReorder).toHaveBeenCalledWith([
      { id: 'cat2', name: 'Cat 2' },
      { id: 'cat1', name: 'Cat 1' },
      { id: 'cat3', name: 'Cat 3' },
    ]);
  });

  it('is a no-op when source or target id is not in the list', () => {
    const onReorder = vi.fn();
    const { handleDragEnd } = useSortableCategories(categories, onReorder);

    handleDragEnd(makeDragEvent('unknown', 'cat2'));

    expect(onReorder).not.toHaveBeenCalled();
  });
});
