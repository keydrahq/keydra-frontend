import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import type { MigrationJob } from '@app/KeyBrowser/types';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import type { NotificationMessage } from '@app/Shared/Services/api.types';
import { defaultServices } from '@app/Shared/Services/Services';
import { connectionFixtures } from '@mocks/handlers';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/**
 * Stands in for the hub socket, so a test can push the server's progress broadcasts.
 *
 * <p>The dialog's whole point is that its numbers arrive over the socket rather than by asking, so
 * a test that only checked what the POST answered would be testing the part that does not matter.
 */
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

const job = (over: Partial<MigrationJob> = {}): MigrationJob => ({
  id: 'job-1',
  sourceConnectionId: 1,
  targetConnectionId: 2,
  match: '*',
  total: null,
  scanned: 0,
  migrated: 0,
  skipped: 0,
  dropped: 0,
  failed: 0,
  deleted: 0,
  reason: null,
  resumed: 0,
  state: 'RUNNING',
  startedAt: '2026-08-19T00:00:00Z',
  finishedAt: null,
  startedBy: null,
  ...over,
});

describe('key migration', () => {
  let hub: FakeHub;
  let started: { keys?: string[]; match?: string; targetConnectionId: number } | undefined;

  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
    hub = new FakeHub();
    started = undefined;

    server.use(
      graphqlWith({
        // The dialog only offers targets that are answering, and the valkey fixture is down
        // on purpose elsewhere. Here it is up, because a migration needs somewhere to go.
        Connections: () => ({
          connections: connectionFixtures.map((profile) =>
            profile.id === 2 ? { ...profile, status: { ...profile.status, state: 'UP' } } : profile,
          ),
        }),
        StartMigration: (variables) => {
          started = variables.migration as typeof started;
          return { startMigration: job() };
        },
      }),
    );
  });

  const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
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
    await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Import and export' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move keys to another server' }));
    await screen.findByRole('combobox', { name: /Destination/ });
  };

  it('offers the ticked keys as the thing to move, rather than asking for a pattern', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    // Nothing was ticked before the dialog opened, so there is no selection to offer.
    expect(screen.queryByLabelText(/ticked in the list/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Every key on this target')).toBeChecked();
  });

  it('sends the ticked keys by name', async () => {
    const user = userEvent.setup();
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
    await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());

    await user.click(screen.getByRole('checkbox', { name: 'Select user:1:profile' }));
    await user.click(screen.getByRole('button', { name: 'Import and export' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move keys to another server' }));

    expect(await screen.findByLabelText('The 1 key ticked in the list')).toBeChecked();

    await user.selectOptions(screen.getByRole('combobox', { name: /Destination/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(started).toBeDefined());
    expect(started?.keys).toEqual(['user:1:profile']);
    // A selection is named, never described: no pattern is sent with it.
    expect(started?.match).toBeUndefined();
  });

  it('follows the job over the hub rather than asking for it', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /Destination/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // Nothing has come back from the walk yet, and "0 moved so far" reads like a stall — so
    // until the first batch the dialog says what is actually happening instead.
    await screen.findByText('Preparing');

    hub.emit(
      'MigrationProgress',
      job({ total: 900, scanned: 500, migrated: 300, skipped: 20, failed: 1 }),
    );
    // Everything dealt with, whichever way it went, against the total the server expects.
    expect(await screen.findByText('321 of 900 keys')).toBeInTheDocument();

    // A later event replaces the numbers rather than adding to them, so a missed event
    // costs nothing.
    hub.emit(
      'MigrationProgress',
      job({ total: 900, scanned: 900, migrated: 879, skipped: 20, failed: 1, state: 'DONE' }),
    );
    // A walk that reached the end reports what it did rather than a fraction of an estimate
    // the walk has since overtaken.
    expect(await screen.findByText('900 keys')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });

  it('ignores progress from somebody else’s job', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /Destination/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText('Preparing');

    hub.emit(
      'MigrationProgress',
      job({ id: 'someone-elses', total: 9999, scanned: 9999, migrated: 9999 }),
    );

    // Still waiting for its own first batch: somebody else's numbers did not land here.
    expect(screen.getByText('Looking for the keys that match')).toBeInTheDocument();
  });
});
