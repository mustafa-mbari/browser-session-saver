import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const service = vi.hoisted(() => ({
  connectFolder: vi.fn(async () => ({ status: 'ok', applied: 0 })),
  reconnectFolder: vi.fn(async () => ({ status: 'ok', applied: 0 })),
  stopSharing: vi.fn(async () => undefined),
  syncNow: vi.fn(async () => ({ status: 'ok', applied: 0 })),
  setSharedModules: vi.fn(async () => undefined),
  removePeer: vi.fn(async () => undefined),
  restorePreShareBackup: vi.fn(async () => true),
  getPreShareBackupDate: vi.fn(async () => null),
  isFolderAccessSupported: vi.fn(() => true),
}));
vi.mock('@core/sync/shared-folder/shared-folder.service', () => service);
vi.mock('@core/services/browser-instance.service', () => ({
  getBrowserInstance: vi.fn(async () => ({ id: 'local', label: 'Chrome' })),
  renameBrowserInstance: vi.fn(async (label: string) => ({ id: 'local', label })),
}));

import SharedFolderSection from '@shared/components/settings/SharedFolderSection';
import SharedFolderBanner from '@shared/components/SharedFolderBanner';

function withState(state: Record<string, unknown> | null) {
  vi.mocked(chrome.storage.local.get).mockImplementation((async () =>
    state ? { shared_folder_state: state } : {}) as unknown as typeof chrome.storage.local.get);
}

const connected = {
  enabled: true,
  status: 'ok',
  folderName: 'Browser Hub',
  lastSyncAt: new Date().toISOString(),
  joinedAt: new Date().toISOString(),
  modules: { sessions: true, settings: true, prompts: true, subscriptions: true, tabGroupTemplates: true, dashboard: true },
  peers: [
    { fileName: 'bh-edge-1.json', instanceId: 'e', label: 'Edge', writtenAt: new Date().toISOString(), lastModified: 1, stale: false },
    { fileName: 'bh-old-2.json', instanceId: 'o', label: 'Old laptop', writtenAt: '2025-01-01T00:00:00.000Z', lastModified: 1, stale: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  service.isFolderAccessSupported.mockReturnValue(true);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SharedFolderSection', () => {
  it('offers to choose a folder when sharing is off', async () => {
    withState(null);
    render(<SharedFolderSection variant="sidepanel" />);

    fireEvent.click(await screen.findByRole('button', { name: /choose folder/i }));

    expect(service.connectFolder).toHaveBeenCalledOnce();
  });

  it('explains when the browser cannot use folders', async () => {
    withState(null);
    service.isFolderAccessSupported.mockReturnValue(false);
    render(<SharedFolderSection variant="newtab" />);

    expect(await screen.findByText(/brave:\/\/flags/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /choose folder/i })).not.toBeInTheDocument();
  });

  it('shows the folder, other browsers and what is shared when connected', async () => {
    withState(connected);
    render(<SharedFolderSection variant="sidepanel" />);

    expect(await screen.findByText('Edge')).toBeInTheDocument();
    expect(screen.getByText(/inactive, not merged/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Start tab' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('switch', { name: 'Sessions' }));
    await waitFor(() =>
      expect(service.setSharedModules).toHaveBeenCalledWith(expect.objectContaining({ sessions: false })),
    );

    fireEvent.click(screen.getByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(service.syncNow).toHaveBeenCalledWith({ interactive: true }));
  });

  it('removes another browser after confirmation', async () => {
    withState(connected);
    render(<SharedFolderSection variant="sidepanel" />);

    fireEvent.click(await screen.findByRole('button', { name: /remove old laptop/i }));

    await waitFor(() => expect(service.removePeer).toHaveBeenCalledWith('bh-old-2.json'));
  });

  it('shows the sync error from the last attempt', async () => {
    withState({ ...connected, status: 'error', lastError: 'Disk full' });
    render(<SharedFolderSection variant="sidepanel" />);

    expect(await screen.findByText(/Disk full/)).toBeInTheDocument();
  });
});

describe('SharedFolderBanner', () => {
  it('asks to reconnect only when permission is needed', async () => {
    withState({ ...connected, status: 'needs-permission' });
    render(<SharedFolderBanner variant="sidepanel" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect' }));
    expect(service.reconnectFolder).toHaveBeenCalledOnce();
  });

  it('stays hidden while everything is fine', async () => {
    withState(connected);
    const { container } = render(<SharedFolderBanner variant="sidepanel" />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container).toBeEmptyDOMElement();
  });
});
