import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notifySyncMutation } from '@core/services/sync-trigger';

describe('notifySyncMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a SYNC_MUTATION message to the background SW', () => {
    notifySyncMutation();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'SYNC_MUTATION',
      payload: {},
    });
  });

  it('does not throw when sendMessage rejects (fire-and-forget)', () => {
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockReturnValue(
      Promise.reject(new Error('SW not ready')),
    );
    expect(() => notifySyncMutation()).not.toThrow();
  });

  it('dispatches a message on every call — debouncing is the SW responsibility', () => {
    notifySyncMutation();
    notifySyncMutation();
    notifySyncMutation();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
  });
});
