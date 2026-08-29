import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@app/Monitoring/Dashboard';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { NotificationService } from '@app/Shared/Services/Notification.service';
import { render } from '@test/utils';

const openDashboard = (notifications: NotificationService) =>
  render(
    <NotificationProvider>
      <Dashboard />
    </NotificationProvider>,
    {
      services: { notifications },
      route: '/connections/1/monitoring',
      path: '/connections/:connectionId/monitoring',
    },
  );

/** Pushes one reading through the hub the dashboard listens on. */
const deliverSample = (notifications: NotificationService, opsPerSecond: number) =>
  act(() =>
    notifications.dispatch(
      JSON.stringify({
        category: 'MetricsSample',
        payload: {
          connectionId: 1,
          sample: {
            at: new Date(60_000).toISOString(),
            memoryUsedBytes: 3_000_000,
            memoryPeakBytes: null,
            memoryMaxBytes: null,
            connectedClients: 9,
            opsPerSecond,
            totalCommands: null,
            keyspaceHits: null,
            keyspaceMisses: null,
            keyCount: null,
            uptimeSeconds: null,
            evictedKeys: null,
            expiredKeys: null,
          },
        },
        ts: new Date(0).toISOString(),
      }),
    ),
  );

describe('Dashboard', () => {
  let notifications: NotificationService;

  beforeEach(() => {
    notifications = new NotificationService('/api/v1/notifications');
  });

  it('does not sample until asked', async () => {
    openDashboard(notifications);

    expect(await screen.findByText('Not being sampled')).toBeInTheDocument();
    expect(
      screen.getByText(/costs a round trip per interval whether anyone is watching/),
    ).toBeInTheDocument();
  });

  it('shows the readings the server already had once sampling starts', async () => {
    const user = userEvent.setup();
    openDashboard(notifications);
    await screen.findByText('Not being sampled');

    await user.click(screen.getByRole('button', { name: 'Start sampling' }));

    // The mock server returns a short run of readings; the latest is the headline.
    expect(await screen.findByText('Sampling every 5s')).toBeInTheDocument();
    expect(screen.getByText('155')).toBeInTheDocument();
  });

  it('updates from the hub without asking the server again', async () => {
    const user = userEvent.setup();
    openDashboard(notifications);
    await screen.findByText('Not being sampled');
    await user.click(screen.getByRole('button', { name: 'Start sampling' }));
    await screen.findByText('Sampling every 5s');

    deliverSample(notifications, 999);

    // The point of the phase: the number changes without a request.
    expect(await screen.findByText('999')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('says a figure is missing rather than drawing it as zero', async () => {
    const user = userEvent.setup();
    openDashboard(notifications);
    await screen.findByText('Not being sampled');
    await user.click(screen.getByRole('button', { name: 'Start sampling' }));
    await screen.findByText('Sampling every 5s');

    deliverSample(notifications, 999);

    // The delivered reading carries no hit counters, so the ratio is absent, not 0%.
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
  });

  it('stops when asked', async () => {
    const user = userEvent.setup();
    openDashboard(notifications);
    await screen.findByText('Not being sampled');
    await user.click(screen.getByRole('button', { name: 'Start sampling' }));
    await screen.findByText('Sampling every 5s');

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(await screen.findByText('Not being sampled')).toBeInTheDocument();
  });

  it('lists slow commands with the duration scaled to read', async () => {
    const user = userEvent.setup();
    openDashboard(notifications);
    await screen.findByText('Not being sampled');
    await user.click(screen.getByRole('button', { name: 'Start sampling' }));

    // 250000 microseconds is a quarter of a second, and says so.
    expect(await screen.findByText('250.0 ms')).toBeInTheDocument();
    expect(screen.getByText('KEYS *')).toBeInTheDocument();
  });

  it('measures big keys only when asked', async () => {
    const user = userEvent.setup();
    openDashboard(notifications);
    await screen.findByText('Not being sampled');
    await user.click(screen.getByRole('button', { name: 'Start sampling' }));
    await screen.findByText('Sampling every 5s');

    // Nothing has been measured, and the card says why rather than showing an empty table.
    expect(screen.getByText('Not measured yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Measure' }));

    expect(await screen.findByText('cache:page:home')).toBeInTheDocument();
    // The ranking states what it was drawn from.
    expect(screen.getByText(/Largest of 1,000 keys measured/)).toBeInTheDocument();
  });
});
