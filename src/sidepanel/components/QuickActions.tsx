import { useState, useEffect } from 'react';
import { Save, X, Monitor } from 'lucide-react';
import Button from '@shared/components/Button';
import { useMessaging } from '@shared/hooks/useMessaging';
import { useSession } from '@shared/hooks/useSession';
import type { CurrentTabsResponse, SaveSessionResponse } from '@core/types/messages.types';
import type { ToastData } from '@shared/components/Toast';

interface QuickActionsProps {
  onToast?: (toast: Omit<ToastData, 'id'>) => void;
}

export default function QuickActions({ onToast }: QuickActionsProps) {
  const { saveSession } = useSession();
  const { sendMessage } = useMessaging();
  const [saving, setSaving] = useState(false);
  const [tabInfo, setTabInfo] = useState<CurrentTabsResponse | null>(null);

  useEffect(() => {
    const fetchTabInfo = async () => {
      const response = await sendMessage<CurrentTabsResponse>({
        action: 'GET_CURRENT_TABS',
        payload: {},
      });
      if (response.success && response.data) {
        setTabInfo(response.data);
      }
    };
    fetchTabInfo();

    const interval = setInterval(fetchTabInfo, 5000);
    return () => clearInterval(interval);
  }, [sendMessage]);

  const handleSave = async (closeAfter = false) => {
    setSaving(true);
    const result = await saveSession({ closeAfter });
    setSaving(false);
    if (result.success) {
      const responseData = result.data as SaveSessionResponse | undefined;
      if (responseData?.isDuplicate) {
        onToast?.({ message: 'Session looks identical to a recent save', type: 'warning' });
      } else {
        onToast?.({ message: 'Session saved successfully', type: 'success' });
      }
    } else {
      onToast?.({ message: result.error ?? 'Failed to save session', type: 'error' });
    }
  };

  const handleSaveAllWindows = async () => {
    setSaving(true);
    const result = await sendMessage({
      action: 'SAVE_SESSION',
      payload: { allWindows: true },
    });
    setSaving(false);
    if (result.success) {
      onToast?.({ message: 'All windows saved', type: 'success' });
    } else {
      onToast?.({ message: result.error ?? 'Failed to save', type: 'error' });
    }
  };

  return (
    <div className="px-3 py-2 space-y-1.5 border-t border-[var(--color-border)]">
      <Button
        icon={Save}
        fullWidth
        loading={saving}
        onClick={() => handleSave(false)}
      >
        Save Session
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={X}
          className="flex-1"
          onClick={() => handleSave(true)}
        >
          Save & Close
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Monitor}
          className="flex-1"
          onClick={handleSaveAllWindows}
        >
          All Windows
        </Button>
        {tabInfo && (
          <span
            className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap shrink-0"
            title={`${tabInfo.tabCount} tab${tabInfo.tabCount !== 1 ? 's' : ''}${tabInfo.groupCount > 0 ? ` · ${tabInfo.groupCount} group${tabInfo.groupCount !== 1 ? 's' : ''}` : ''}`}
          >
            {tabInfo.tabCount}t{tabInfo.groupCount > 0 && ` · ${tabInfo.groupCount}g`}
          </span>
        )}
      </div>
    </div>
  );
}
