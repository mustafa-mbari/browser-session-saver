import { useCallback } from 'react';
import type { Message, MessageResponse } from '@core/types/messages.types';

export function useMessaging() {
  const sendMessage = useCallback(
    async <T = unknown>(message: Message): Promise<MessageResponse<T>> => {
      try {
        const response = await chrome.runtime.sendMessage(message);
        return response as MessageResponse<T>;
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    [],
  );

  return { sendMessage };
}
