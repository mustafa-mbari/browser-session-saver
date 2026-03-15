import type { Session, Tab, AutoSaveTrigger } from './session.types';
import type { Settings } from './settings.types';

export type ExportFormat = 'json' | 'html' | 'markdown' | 'csv' | 'text';
export type ImportSource = 'json' | 'html' | 'url_list';
export type RestoreMode = 'new_window' | 'current' | 'append';

export interface SessionFilter {
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  isAutoSave?: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
}

export interface SessionSort {
  field: 'createdAt' | 'updatedAt' | 'name' | 'tabCount';
  direction: 'asc' | 'desc';
}

export type Message =
  | { action: 'SAVE_SESSION'; payload: { windowId?: number; name?: string; closeAfter?: boolean; allWindows?: boolean } }
  | { action: 'RESTORE_SESSION'; payload: { sessionId: string; mode: RestoreMode } }
  | { action: 'DELETE_SESSION'; payload: { sessionId: string } }
  | {
      action: 'GET_SESSIONS';
      payload: { filter?: SessionFilter; sort?: SessionSort };
    }
  | { action: 'GET_CURRENT_TABS'; payload: Record<string, never> }
  | {
      action: 'EXPORT_SESSIONS';
      payload: { sessionIds: string[]; format: ExportFormat };
    }
  | { action: 'IMPORT_SESSIONS'; payload: { data: string; source: ImportSource } }
  | { action: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { action: 'GET_SETTINGS'; payload: Record<string, never> }
  | { action: 'AUTO_SAVE_STATUS'; payload: Record<string, never> }
  | { action: 'UPDATE_SESSION'; payload: { sessionId: string; updates: Partial<Session> } }
  | { action: 'UNDELETE_SESSION'; payload: { session: Session } }
  | { action: 'MERGE_SESSIONS'; payload: { sessionIds: string[]; targetName: string } }
  | { action: 'DIFF_SESSIONS'; payload: { sessionIdA: string; sessionIdB: string } }
  | { action: 'RESTORE_SELECTED_TABS'; payload: { sessionId: string; tabIds: string[]; mode: RestoreMode } }
  | { action: 'UPDATE_SESSION_TABS'; payload: { sessionId: string } };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AutoSaveStatusResponse {
  isActive: boolean;
  lastAutoSave: string | null;
  lastTrigger: AutoSaveTrigger | null;
}

export interface CurrentTabsResponse {
  tabCount: number;
  groupCount: number;
  windowId: number;
}

export interface SessionDiffResponse {
  added: Tab[];
  removed: Tab[];
  unchanged: Tab[];
}

export interface SaveSessionResponse {
  session: Session | Session[];
  isDuplicate: boolean;
}
