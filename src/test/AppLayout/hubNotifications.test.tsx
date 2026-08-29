import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { FC } from 'react';
import { useHubNotifications } from '@app/AppLayout/useHubNotifications';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import type { NotificationMessage } from '@app/Shared/Services/api.types';
import { defaultServices, ServiceContext } from '@app/Shared/Services/Services';
import type { Services } from '@app/Shared/Services/Services';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Stands in for the hub socket, so a test can push what the server would broadcast. */
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
        ?.forEach((listener) => listener({ category, payload, ts: '2026-08-21T00:00:00Z' }));
    });
  }

  connect(): void {}
  disconnect(): void {}
}

const Subscriber: FC = () => {
  useHubNotifications();
  return null;
};

const status = (state: string, previousState: string | null) => ({
  id: 1,
  name: 'payments-cache',
  status: { state, message: null, server: null, checkedAt: null },
  previousState,
});

let hub: FakeHub;

const mount = () => {
  hub = new FakeHub();
  const services = { ...defaultServices, notifications: hub } as unknown as Services;
  render(
    <ServiceContext.Provider value={services}>
      <QueryClientProvider client={new QueryClient()}>
        <NotificationProvider>
          <Subscriber />
        </NotificationProvider>
      </QueryClientProvider>
    </ServiceContext.Provider>,
  );
};

/**
 * Which status changes are worth interrupting somebody about.
 *
 * <p>The rule is that "it is up" and "it is up again" are different sentences and only the second
 * one is news. Signing in probes every target for the first time, and every one of them reaches
 * "up" from nothing — which used to greet everybody with a success toast per healthy target.
 */
describe('connection status notifications', () => {
  beforeEach(() => {
    mount();
  });

  it('says nothing the first time it hears a target is up', async () => {
    hub.emit('ConnectionStatusChanged', status('UP', null));

    await waitFor(() => expect(screen.queryByText(/payments-cache/)).not.toBeInTheDocument());
  });

  it('says nothing when a re-check finds a target still up', async () => {
    // A refresh passes through "connecting", and the server reports the last state the
    // target actually settled in rather than that step.
    hub.emit('ConnectionStatusChanged', status('UP', 'UP'));

    await waitFor(() => expect(screen.queryByText(/payments-cache/)).not.toBeInTheDocument());
  });

  it('says so when a target that was down comes back', async () => {
    hub.emit('ConnectionStatusChanged', status('UP', 'DOWN'));

    expect(await screen.findByText(/payments-cache.*came up/)).toBeInTheDocument();
  });

  it('says so when a target that was up stops answering', async () => {
    hub.emit('ConnectionStatusChanged', status('DOWN', 'UP'));

    expect(await screen.findByText(/payments-cache.*went down/)).toBeInTheDocument();
  });

  it('does not announce a target that has never answered', async () => {
    // Adding a profile that points at nothing is a form's problem, not an interruption.
    hub.emit('ConnectionStatusChanged', status('DOWN', null));

    await waitFor(() => expect(screen.queryByText(/payments-cache/)).not.toBeInTheDocument());
  });
});
