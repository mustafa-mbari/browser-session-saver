/**
 * TodoCardBody.test.tsx
 *
 * Regression test for the dashboard todo-widget delete path.
 *
 * Root cause of fixed bug: the remove handler previously only updated the
 * local noteContent JSON (via onUpdate) without calling the service-layer
 * deleteTodoItem(). This left the item alive in IndexedDB and on Supabase,
 * so pullTodos() re-hydrated it back into the widget on the next sync cycle.
 *
 * These tests pin the fix: every remove click must call deleteTodoItem() so
 * the IDB record is deleted and a tombstone is recorded for cross-device
 * propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@core/services/todo.service', () => ({
  deleteTodoItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@core/utils/uuid', () => ({
  generateId: vi.fn().mockReturnValue('new-item-id'),
}));

import { deleteTodoItem } from '@core/services/todo.service';
import TodoCardBody from '@newtab/components/TodoCardBody';

const TWO_ITEMS = JSON.stringify([
  { id: 'id1', text: 'Alpha', done: false },
  { id: 'id2', text: 'Beta', done: false },
]);

describe('TodoCardBody — delete path regression', () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteTodoItem with the correct id when remove is clicked', () => {
    render(<TodoCardBody rawContent={TWO_ITEMS} onUpdate={onUpdate} colSpan={3} rowSpan={3} />);

    const removeButtons = screen.getAllByRole('button', { name: 'Remove item' });
    fireEvent.click(removeButtons[0]); // removes "Alpha" (id1)

    expect(deleteTodoItem).toHaveBeenCalledWith('id1');
    expect(deleteTodoItem).toHaveBeenCalledTimes(1);
  });

  it('removes the deleted item from the UI via onUpdate', () => {
    render(<TodoCardBody rawContent={TWO_ITEMS} onUpdate={onUpdate} colSpan={3} rowSpan={3} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[0]);

    const updated = JSON.parse(onUpdate.mock.calls[0][0] as string) as Array<{ id: string }>;
    expect(updated.every((it) => it.id !== 'id1')).toBe(true);
  });

  it('does not affect other items when one is deleted', () => {
    render(<TodoCardBody rawContent={TWO_ITEMS} onUpdate={onUpdate} colSpan={3} rowSpan={3} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[0]);

    const updated = JSON.parse(onUpdate.mock.calls[0][0] as string) as Array<{ id: string }>;
    expect(updated.some((it) => it.id === 'id2')).toBe(true);
  });

  it('does NOT call deleteTodoItem when adding a new item', () => {
    render(<TodoCardBody rawContent={TWO_ITEMS} onUpdate={onUpdate} colSpan={3} rowSpan={3} />);

    const input = screen.getByPlaceholderText('Add item…');
    fireEvent.change(input, { target: { value: 'New task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    expect(deleteTodoItem).not.toHaveBeenCalled();
    // onUpdate is still called with the new item appended.
    // NOTE: add() intentionally does NOT write to IDB — dashboard widget todos
    // live only in noteContent (the category's JSON field). pullTodos rebuilds
    // noteContent FROM IDB, not the other way. This means widget-added items
    // are local-display-only and are not synced to Supabase.
    expect(onUpdate).toHaveBeenCalled();
  });

  it('does NOT call deleteTodoItem when toggling an item done/undone', () => {
    render(<TodoCardBody rawContent={TWO_ITEMS} onUpdate={onUpdate} colSpan={3} rowSpan={3} />);

    const checkboxes = screen.getAllByRole('button', { name: 'Mark complete' });
    fireEvent.click(checkboxes[0]);

    expect(deleteTodoItem).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();
  });
});
