import { useState, useEffect } from 'react';
import { Save, X, Monitor } from 'lucide-react';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { CurrentTabsResponse } from '@core/types/messages.types';

interface QuickActionsProps {
  onToast?: (message: string, type: 'success' | 'error') => void;
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
      onToast?.('Session saved successfully', 'success');
    } else {
      onToast?.(result.error ?? 'Failed to save session', 'error');
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
      onToast?.('All windows saved', 'success');
    } else {
      onToast?.(result.error ?? 'Failed to save', 'error');
    }
  };

  return (
    <div className="px-3 py-3 space-y-2 border-b border-[var(--color-border)]">
      <Button
        icon={Save}
        fullWidth
        loading={saving}
        onClick={() => handleSave(false)}
      >
        Save Session
      </Button>
      <div className="flex gap-2">
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
      </div>
      {tabInfo && (
        <div className="flex justify-center">
          <Badge>
            {tabInfo.tabCount} tab{tabInfo.tabCount !== 1 ? 's' : ''}
            {tabInfo.groupCount > 0 && ` · ${tabInfo.groupCount} group${tabInfo.groupCount !== 1 ? 's' : ''}`}
          </Badge>
        </div>
      )}
    </div>
  );
}
