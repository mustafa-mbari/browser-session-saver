import { useState, useEffect } from 'react';
import { X, History, RotateCcw } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import * as SessionService from '@core/services/session.service';
import { useMessaging } from '@shared/hooks/useMessaging';
import { formatRelative } from '@core/utils/date';

const PROMPT_KEY = 'session_restore_prompt';
const PROMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PromptRecord {
  shownAt: number;
}

async function getPromptRecord(): Promise<PromptRecord | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(PROMPT_KEY, (result) => {
      resolve((result[PROMPT_KEY] as PromptRecord | undefined) ?? null);
    });
  });
}

async function clearPrompt(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(PROMPT_KEY, resolve);
  });
}

export default function SessionRestoreReminder() {
  const [session, setSession] = useState<Session | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { sendMessage } = useMessaging();

  useEffect(() => {
    async function check() {
      const record = await getPromptRecord();
      if (!record) return;
      if (Date.now() - record.shownAt > PROMPT_MAX_AGE_MS) {
        void clearPrompt();
        return;
      }

      const autoSaves = await SessionService.getAllSessions({ isAutoSave: true });
      if (autoSaves.length > 0) {
        setSession(autoSaves[0]);
      }
    }
    void check();
  }, []);

  const handleDismiss = async () => {
    await clearPrompt();
    setDismissed(true);
  };

  const handleRestore = async () => {
    if (!session) return;
    setRestoring(true);
    await sendMessage({
      action: 'RESTORE_SESSION',
      payload: { sessionId: session.id, mode: 'new_window' },
    });
    await clearPrompt();
    setDismissed(true);
    setRestoring(false);
  };

  if (dismissed || !session) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-xs w-full rounded-xl border border-blue-500/30 backdrop-blur-xl shadow-2xl"
      style={{ background: 'rgba(10,10,20,0.80)' }}
      role="alert"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <History size={14} className="text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-white flex-1">
          Restore last session?
        </span>
        <button
          onClick={handleDismiss}
          className="p-0.5 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white/90"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Session info */}
      <div className="px-3 py-2.5">
        <p className="text-sm text-white/80 truncate">{session.name}</p>
        <p className="text-xs text-white/50 mt-0.5">
          {session.tabCount} tab{session.tabCount !== 1 ? 's' : ''} · saved {formatRelative(session.updatedAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2">
        <button
          onClick={handleDismiss}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          Not now
        </button>
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {restoring ? (
            <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <RotateCcw size={12} />
          )}
          Restore in new window
        </button>
      </div>
    </div>
  );
}
