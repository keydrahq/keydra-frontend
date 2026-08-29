import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { defaultServices } from '@app/Shared/Services/Services';
import type { NotificationMessage } from '@app/Shared/Services/api.types';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/** The hub, as a thing a test can push a message into. */
class FakeHub {
  private readonly listeners = new Map<string, Set<(message: NotificationMessage) => void>>();

  subscribe<T>(category: string, listener: (message: NotificationMessage<T>) => void): () => void {
    const existing = this.listeners.get(category) ?? new Set();
    existing.add(listener as (message: NotificationMessage) => void);
    this.listeners.set(category, existing);
    return () => existing.delete(listener as (message: NotificationMessage) => void);
  }

  emit(category: string, payload: unknown): void {
    act(() => {
      this.listeners
        .get(category)
        ?.forEach((listener) => listener({ category, payload, ts: '2026-08-19T00:00:00Z' }));
    });
  }

  connect(): void {}
  disconnect(): void {}
}

/**
 * A key somebody has open, changed by something that is not Keydra.
 *
 * <p>What is asserted is the decision rather than the plumbing: the panel says what happened and
 * offers to load it, and does not replace what is on the screen. It cannot tell a reader from
 * somebody who is typing — the draft lives inside whichever editor the value's type selected — so
 * guessing would be losing somebody's work to an event that was only ever a hint.
 */
describe('a key that changed while it was open', () => {
  let hub: FakeHub;

  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
    hub = new FakeHub();
  });

  const openKey = async (user: ReturnType<typeof userEvent.setup>) => {
    render(
      <NotificationProvider>
        <KeyBrowser />
      </NotificationProvider>,
      {
        route: '/connections/1/keys',
        path: '/connections/:connectionId/keys',
        services: { ...defaultServices, notifications: hub as never },
      },
    );
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
    act(() => FakeEventSource.latest().replayMatching());
    await user.click(await screen.findByRole('button', { name: 'user:1:profile' }));
    await screen.findByRole('heading', { name: 'user:1:profile' });
  };

  const change = (keys: Record<string, string>) =>
    hub.emit('KeysChanged', {
      connectionId: 1,
      database: 0,
      source: 'target',
      affected: 900,
      // Deliberately overflowed: the sample is bounded and the whole point of the watched map is
      // that it answers where the sample cannot.
      keys: [],
      sampled: true,
      watched: keys,
    });

  it('says what happened rather than replacing what is on the screen', async () => {
    const user = userEvent.setup();
    await openKey(user);

    change({ 'user:1:profile': 'set' });

    expect(await screen.findByText('Something else changed this key (set)')).toBeInTheDocument();
    // Still showing what Keydra read. An event carries no value and never patches one.
    expect(screen.getByRole('heading', { name: 'user:1:profile' })).toBeInTheDocument();
  });

  it('says a key is gone rather than going on showing what it held', async () => {
    const user = userEvent.setup();
    await openKey(user);

    change({ 'user:1:profile': 'expired' });

    expect(await screen.findByText('This key is gone (expired)')).toBeInTheDocument();
  });

  it('says nothing about a change to some other key', async () => {
    const user = userEvent.setup();
    await openKey(user);

    change({ 'user:2:profile': 'set' });

    await waitFor(() =>
      expect(screen.queryByText(/Something else changed this key/)).not.toBeInTheDocument(),
    );
  });
});
