import { useState, useCallback, useEffect } from 'react';
import type { Session } from '@core/types/session.types';
import type { SessionFilter, SessionSort, RestoreMode, GetSessionsResponse } from '@core/types/messages.types';
import { useMessaging } from './useMessaging';
import { useDataChanged } from './useDataChanged';
import * as SessionService from '@core/services/session.service';

/**
 * Session actions without loading the session list — for rows and cards, which
 * would otherwise each load (and reload) every session.
 */
export function useSessionActions() {
  const { sendMessage } = useMessaging();

  const saveSession = useCallback(
    async (options?: { name?: string; closeAfter?: boolean }) => {
      const response = await sendMessage<Session>({
        action: 'SAVE_SESSION',
        payload: { name: options?.name, closeAfter: options?.closeAfter },
      });
      return response;
    },
    [sendMessage],
  );

  const restoreSession = useCallback(
    async (sessionId: string, mode: RestoreMode = 'new_window') => {
      return sendMessage({
        action: 'RESTORE_SESSION',
        payload: { sessionId, mode },
      });
    },
    [sendMessage],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const response = await sendMessage({
        action: 'DELETE_SESSION',
        payload: { sessionId },
      });
      return response;
    },
    [sendMessage],
  );

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<Session>) => {
      const response = await sendMessage<Session>({
        action: 'UPDATE_SESSION',
        payload: { sessionId, updates },
      });
      return response;
    },
    [sendMessage],
  );

  const updateSessionTabs = useCallback(
    async (sessionId: string) => {
      const response = await sendMessage<{ addedCount: number; removedCount: number }>({
        action: 'UPDATE_SESSION_TABS',
        payload: { sessionId },
      });
      return response;
    },
    [sendMessage],
  );

  return { saveSession, restoreSession, deleteSession, updateSession, updateSessionTabs };
}

/** The session list (kept current) plus the session actions. */
export function useSession() {
  const { sendMessage } = useMessaging();
  const actions = useSessionActions();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(
    async (filter?: SessionFilter, sort?: SessionSort, limit?: number, offset?: number) => {
      setLoading(true);
      setError(null);
      const response = await sendMessage<GetSessionsResponse>({
        action: 'GET_SESSIONS',
        payload: { filter, sort, limit, offset },
      });
      if (response.success && response.data) {
        setSessions(response.data.sessions);
        setTotalCount(response.data.totalCount);
      } else {
        setError(response.error ?? 'Failed to load sessions');
      }
      setLoading(false);
    },
    [sendMessage],
  );

  // Initial load
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Refresh when sessions change anywhere: this page, another page, the service
  // worker (saves, deletes, auto-saves) or a shared-folder sync. Read directly from
  // IndexedDB to avoid the SW round-trip, which can fail if the SW is asleep.
  useDataChanged(['sessions'], () => {
    void SessionService.getAllSessions().then((updated) => {
      setSessions(updated);
      setTotalCount(updated.length);
    });
  });

  return {
    sessions,
    totalCount,
    loading,
    error,
    ...actions,
    refreshSessions,
  };
}
