import { useState, useCallback, useEffect } from 'react';
import type { Session } from '@core/types/session.types';
import type { SessionFilter, SessionSort, RestoreMode } from '@core/types/messages.types';
import { useMessaging } from './useMessaging';

export function useSession() {
  const { sendMessage } = useMessaging();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(
    async (filter?: SessionFilter, sort?: SessionSort) => {
      setLoading(true);
      setError(null);
      const response = await sendMessage<Session[]>({
        action: 'GET_SESSIONS',
        payload: { filter, sort },
      });
      if (response.success && response.data) {
        setSessions(response.data);
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
      if (response.success) {
        await refreshSessions();
      }
      return response;
    },
    [sendMessage, refreshSessions],
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
      if (response.success) {
        await refreshSessions();
      }
      return response;
    },
    [sendMessage, refreshSessions],
  );

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<Session>) => {
      const response = await sendMessage<Session>({
        action: 'UPDATE_SESSION',
        payload: { sessionId, updates },
      });
      if (response.success) {
        await refreshSessions();
      }
      return response;
    },
    [sendMessage, refreshSessions],
  );

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  return {
    sessions,
    loading,
    error,
    saveSession,
    restoreSession,
    deleteSession,
    updateSession,
    refreshSessions,
  };
}
