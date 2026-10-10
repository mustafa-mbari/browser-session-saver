import { useState, useCallback, useEffect } from 'react';
import type { Session } from '@core/types/session.types';
import type { SessionFilter, SessionSort, RestoreMode, GetSessionsResponse } from '@core/types/messages.types';
import { useMessaging } from './useMessaging';
import { useDataChanged } from './useDataChanged';
import * as SessionService from '@core/services/session.service';

export function useSession() {
  const { sendMessage } = useMessaging();
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

  // Initial load
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Refresh when sessions change anywhere: this page, another page, or the service
  // worker (saves, deletes, auto-saves). Read directly from IndexedDB to avoid the SW
  // round-trip, which can fail if the SW is asleep.
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
    saveSession,
    restoreSession,
    deleteSession,
    updateSession,
    updateSessionTabs,
    refreshSessions,
  };
}
