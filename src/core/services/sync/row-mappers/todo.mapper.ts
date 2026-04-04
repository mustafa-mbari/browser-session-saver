import type { TodoList, TodoItem } from '@core/types/newtab.types';
import type { RowMapper } from '@core/types/base.types';

export const todoListMapper: RowMapper<TodoList> = {
  toRow(l: TodoList, userId: string): Record<string, unknown> {
    return {
      id: l.id,
      user_id: userId,
      name: l.name,
      icon: l.icon ?? null,
      position: l.position,
      created_at: l.createdAt,
    };
  },

  fromRow(r: Record<string, unknown>): TodoList {
    return {
      id: r.id as string,
      name: r.name as string,
      icon: (r.icon ?? '') as string,
      position: (r.position ?? 0) as number,
      createdAt: r.created_at as string,
    };
  },
};

export const todoItemMapper: RowMapper<TodoItem> = {
  toRow(i: TodoItem, userId: string): Record<string, unknown> {
    return {
      id: i.id,
      user_id: userId,
      list_id: i.listId,
      text: i.text,
      completed: i.completed,
      priority: i.priority,
      due_date: i.dueDate ?? null,
      position: i.position,
      created_at: i.createdAt,
      completed_at: i.completedAt ?? null,
    };
  },

  fromRow(r: Record<string, unknown>): TodoItem {
    return {
      id: r.id as string,
      listId: r.list_id as string,
      text: r.text as string,
      completed: (r.completed ?? false) as boolean,
      priority: (r.priority ?? 'none') as TodoItem['priority'],
      dueDate: (r.due_date ?? undefined) as string | undefined,
      position: (r.position ?? 0) as number,
      createdAt: r.created_at as string,
      completedAt: (r.completed_at ?? undefined) as string | undefined,
    };
  },
};
