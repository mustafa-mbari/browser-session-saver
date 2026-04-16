import { useCallback } from 'react';
import type { Message, MessageResponse } from '@core/types/messages.types';
import { MESSAGE_TIMEOUT_MS } from '@core/constants/timings';

export function useMessaging() {
  const sendMessage = useCallback(
    async <T = unknown>(message: Message): Promise<MessageResponse<T>> => {
      try {
        const timeout = new Promise<MessageResponse<T>>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Service worker timeout', timedOut: true }), MESSAGE_TIMEOUT_MS),
        );
        const response = await Promise.race([chrome.runtime.sendMessage(message), timeout]) as MessageResponse<T>;
        if (!response.success && response.limitStatus) {
          window.dispatchEvent(new CustomEvent('limit-reached', { detail: response.limitStatus }));
        }
        return response;
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    [],
  );

  return { sendMessage };
}
