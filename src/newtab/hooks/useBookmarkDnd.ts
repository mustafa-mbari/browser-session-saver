import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';

export function useSortableItems<T extends { id: string }>(
  items: T[],
  onReorder: (newItems: T[]) => void,
) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return { handleDragEnd };
}

export function useSortableCategories<T extends { id: string }>(
  categories: T[],
  onReorder: (newCategories: T[]) => void,
) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(categories, oldIndex, newIndex));
  };

  return { handleDragEnd };
}
