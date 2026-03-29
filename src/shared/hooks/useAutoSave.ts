import { useState, useEffect } from 'react';
import type { AutoSaveStatusResponse } from '@core/types/messages.types';
import { useMessaging } from './useMessaging';

export function useAutoSave() {
  const { sendMessage } = useMessaging();
  const [status, setStatus] = useState<AutoSaveStatusResponse>({
    isActive: false,
    lastAutoSave: null,
  });

  useEffect(() => {
    const fetchStatus = async () => {
      const response = await sendMessage<AutoSaveStatusResponse>({
        action: 'AUTO_SAVE_STATUS',
        payload: {},
      });
      if (response.success && response.data) {
        setStatus(response.data);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [sendMessage]);

  return status;
}
