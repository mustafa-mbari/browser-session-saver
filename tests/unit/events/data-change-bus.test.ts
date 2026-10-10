import { describe, it, expect, vi, afterEach } from 'vitest';
import { notifyDataChanged, onDataChanged } from '@core/events/data-change-bus';

const unsubscribers: (() => void)[] = [];
afterEach(() => unsubscribers.splice(0).forEach((off) => off()));

function listen() {
  const listener = vi.fn();
  unsubscribers.push(onDataChanged(listener));
  return listener;
}

describe('data-change-bus', () => {
  it('coalesces a burst of notifications into one event', async () => {
    const listener = listen();

    notifyDataChanged('sessions');
    notifyDataChanged('prompts', 'sessions');

    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect([...listener.mock.calls[0][0]].sort()).toEqual(['prompts', 'sessions']);
  });

  it('reaches other pages and the service worker', async () => {
    const otherPage = new BroadcastChannel('browser-hub-data');
    const received = vi.fn();
    otherPage.addEventListener('message', (event) => received(event.data));

    notifyDataChanged('dashboard');

    await vi.waitFor(() => expect(received).toHaveBeenCalledWith({ modules: ['dashboard'] }));
    otherPage.close();
  });

  it('delivers changes announced by another page', async () => {
    const listener = listen();
    const otherPage = new BroadcastChannel('browser-hub-data');

    otherPage.postMessage({ modules: ['subscriptions'] });

    await vi.waitFor(() => expect(listener).toHaveBeenCalled());
    expect([...listener.mock.calls[0][0]]).toEqual(['subscriptions']);
    otherPage.close();
  });

  it('stops delivering after unsubscribe', async () => {
    const listener = vi.fn();
    const off = onDataChanged(listener);
    off();

    notifyDataChanged('sessions');
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(listener).not.toHaveBeenCalled();
  });
});
