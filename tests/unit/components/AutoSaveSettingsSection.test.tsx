import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AutoSaveSettingsSection from '@shared/components/settings/AutoSaveSettingsSection';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';

function mockServiceWorker(stored: Record<string, unknown> = {}) {
  vi.mocked(chrome.runtime.sendMessage).mockImplementation((async (message: { action: string }) => {
    if (message.action === 'GET_SETTINGS') {
      return { success: true, data: { ...DEFAULT_SETTINGS, ...stored } };
    }
    return { success: true };
  }) as unknown as typeof chrome.runtime.sendMessage);
}

describe('AutoSaveSettingsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceWorker();
  });

  it.each(['sidepanel', 'newtab'] as const)('renders the %s variant without removed settings', async (variant) => {
    render(<AutoSaveSettingsSection variant={variant} />);

    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable auto-save' })).toBeInTheDocument());
    expect(screen.getByRole('switch', { name: 'Close tabs after saving' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Auto-delete old sessions' })).toHaveValue('never');
    expect(screen.queryByText(/battery/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/max auto-saves/i)).not.toBeInTheDocument();
  });

  it('sends a setting change to the service worker', async () => {
    render(<AutoSaveSettingsSection variant="sidepanel" />);
    const toggle = await screen.findByRole('switch', { name: 'Close tabs after saving' });

    fireEvent.click(toggle);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'UPDATE_SETTINGS',
      payload: { closeTabsAfterSave: true },
    });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('stores "never" as null for auto-delete', async () => {
    mockServiceWorker({ autoDeleteAfterDays: 30 });
    render(<AutoSaveSettingsSection variant="newtab" />);
    const select = await screen.findByRole('combobox', { name: 'Auto-delete old sessions' });
    await waitFor(() => expect(select).toHaveValue('30'));

    fireEvent.change(select, { target: { value: 'never' } });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'UPDATE_SETTINGS',
      payload: { autoDeleteAfterDays: null },
    });
  });

  it('hides the auto-save options while auto-save is off', async () => {
    mockServiceWorker({ enableAutoSave: false });
    render(<AutoSaveSettingsSection variant="sidepanel" />);
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Enable auto-save' })).toHaveAttribute('aria-checked', 'false'),
    );
    expect(screen.queryByRole('switch', { name: 'Save on browser close' })).not.toBeInTheDocument();
  });

  it('follows settings changed on another page', async () => {
    render(<AutoSaveSettingsSection variant="sidepanel" />);
    const toggle = await screen.findByRole('switch', { name: 'Close tabs after saving' });
    const listener = vi.mocked(chrome.storage.local.onChanged.addListener).mock.calls.at(-1)![0];

    act(() => {
      listener({ settings: { newValue: { ...DEFAULT_SETTINGS, closeTabsAfterSave: true } } }, 'local');
    });

    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
