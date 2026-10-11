import { useState } from 'react';
import { FolderSync } from 'lucide-react';
import { reconnectFolder } from '@core/sync/shared-folder/shared-folder.service';
import { useSharedFolderState } from '@shared/hooks/useSharedFolder';

interface Props {
  variant: 'sidepanel' | 'newtab';
}

/**
 * Shown when the browser wants permission to the shared folder again (it may ask
 * after a restart). Granting needs a click, so syncing cannot do it alone.
 */
export default function SharedFolderBanner({ variant }: Props) {
  const state = useSharedFolderState();
  const [busy, setBusy] = useState(false);
  if (!state.enabled || state.status !== 'needs-permission') return null;

  const reconnect = async () => {
    setBusy(true);
    try {
      await reconnectFolder();
    } finally {
      setBusy(false);
    }
  };

  const styles =
    variant === 'sidepanel'
      ? 'mx-3 mt-2 border border-(--color-border) bg-(--color-bg-secondary) text-(--color-text)'
      : 'glass-panel fixed top-14 left-1/2 -translate-x-1/2 z-40 text-(--newtab-text)';

  return (
    <div role="status" className={`${styles} flex items-center gap-2 rounded-lg px-3 py-2 text-sm`}>
      <FolderSync size={15} className="shrink-0" />
      <span className="flex-1">Shared folder: the browser needs your permission again.</span>
      <button
        onClick={() => void reconnect()}
        disabled={busy}
        className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Reconnect
      </button>
    </div>
  );
}
