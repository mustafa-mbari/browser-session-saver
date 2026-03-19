import { create } from 'zustand';
import type {
  Board,
  BookmarkCategory,
  BookmarkEntry,
  QuickLink,
  TodoItem,
  TodoList,
} from '@core/types/newtab.types';

interface NewTabDataState {
  boards: Board[];
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  quickLinks: QuickLink[];
  todoLists: TodoList[];
  todoItems: TodoItem[];

  setBoards: (boards: Board[]) => void;
  setCategories: (cats: BookmarkCategory[]) => void;
  setEntries: (entries: BookmarkEntry[]) => void;
  setQuickLinks: (links: QuickLink[]) => void;
  setTodoLists: (lists: TodoList[]) => void;
  setTodoItems: (items: TodoItem[]) => void;
}

export const useNewTabDataStore = create<NewTabDataState>((set) => ({
  boards: [],
  categories: [],
  entries: [],
  quickLinks: [],
  todoLists: [],
  todoItems: [],

  setBoards: (boards) => set({ boards }),
  setCategories: (categories) => set({ categories }),
  setEntries: (entries) => set({ entries }),
  setQuickLinks: (quickLinks) => set({ quickLinks }),
  setTodoLists: (todoLists) => set({ todoLists }),
  setTodoItems: (todoItems) => set({ todoItems }),
}));
