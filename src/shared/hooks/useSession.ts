import { useState, useCallback, useEffect } from 'react';
import type { Session } from '@core/types/session.types';
import type { SessionFilter, SessionSort, RestoreMode, GetSessionsResponse } from '@core/types/messages.types';
import { useMessaging } from './useMessaging';
import * as SessionService from '@core/services/session.service';

/** Write a timestamp to storage so every extension page sees the change. */
function notifySessionsChanged(): void {
  window.dispatchEvent(new CustomEvent('session-changed'));
  chrome.storage.local.set({ _sessions_updated: Date.now() });
}

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
      if (response.success) {
        notifySessionsChanged();
      }
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
      if (response.success) {
        notifySessionsChanged();
      }
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
      if (response.success) {
        notifySessionsChanged();
      }
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
      if (response.success) {
        notifySessionsChanged();
      }
      return response;
    },
    [sendMessage],
  );

  // Initial load
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // In-page refresh (same window)
  useEffect(() => {
    const handler = () => { void refreshSessions(); };
    window.addEventListener('session-changed', handler);
    return () => window.removeEventListener('session-changed', handler);
  }, [refreshSessions]);

  // Cross-page refresh (sidepanel ↔ dashboard).
  // Read directly from IndexedDB to avoid the SW round-trip which can fail
  // with "message port closed before a response was received" if the SW is sleeping.
  useEffect(() => {
    const handler = async () => {
      const updated = await SessionService.getAllSessions();
      setSessions(updated);
      setTotalCount(updated.length);
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
  }, []);

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
