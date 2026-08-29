import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PubSub } from '@app/PubSub/PubSub';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { NotificationService } from '@app/Shared/Services/Notification.service';
import { render } from '@test/utils';

/** A service whose socket the test drives, so messages can be delivered on demand. */
const drivableNotifications = () => new NotificationService('/api/v1/notifications');

const openPage = (notifications: NotificationService) => {
  render(
    <NotificationProvider>
      <PubSub />
    </NotificationProvider>,
    {
      services: { notifications },
      route: '/connections/1/pubsub',
      path: '/connections/:connectionId/pubsub',
    },
  );
};

/** Pushes one hub envelope through the service the page is listening on. */
const deliver = (notifications: NotificationService, channel: string, payload: string) =>
  act(() =>
    notifications.dispatch(
      JSON.stringify({
        category: 'ChannelMessage',
        payload: { connectionId: 1, channel, pattern: '', payload },
        ts: new Date(0).toISOString(),
      }),
    ),
  );

describe('PubSub', () => {
  let notifications: NotificationService;

  beforeEach(() => {
    notifications = drivableNotifications();
  });

  it('says nothing is being listened to before anything is subscribed', async () => {
    openPage(notifications);

    expect(await screen.findByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByText('Subscribe to a channel to see messages arrive.')).toBeInTheDocument();
  });

  it('subscribes to the channels that were typed', async () => {
    const user = userEvent.setup();
    openPage(notifications);

    await user.type(screen.getByLabelText('Channels'), 'news, events');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    // The open subscription is shown back, split into names.
    expect(await screen.findByText('Currently listening')).toBeInTheDocument();
    const listening = screen
      .getByText('Currently listening')
      .closest<HTMLElement>('.pf-v6-c-card')!;
    expect(within(listening).getByText('news')).toBeInTheDocument();
    expect(within(listening).getByText('events')).toBeInTheDocument();
  });

  it('shows messages as they arrive on the hub', async () => {
    const user = userEvent.setup();
    openPage(notifications);
    await user.type(screen.getByLabelText('Channels'), 'news');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    await screen.findByText('Currently listening');

    deliver(notifications, 'news', 'first message');

    expect(await screen.findByText('first message')).toBeInTheDocument();
  });

  it('ignores messages meant for another target', async () => {
    openPage(notifications);

    act(() =>
      notifications.dispatch(
        JSON.stringify({
          category: 'ChannelMessage',
          payload: { connectionId: 99, channel: 'news', pattern: '', payload: 'not ours' },
          ts: new Date(0).toISOString(),
        }),
      ),
    );

    await waitFor(() => expect(screen.queryByText('not ours')).not.toBeInTheDocument());
  });

  it('publishes to the channel that was named', async () => {
    const user = userEvent.setup();
    openPage(notifications);

    // PatternFly appends the required marker to the label, and "Channels" above would
    // match a looser pattern, so the boundary matters.
    await user.type(screen.getByLabelText(/^Channel\b/), 'news');
    await user.type(screen.getByLabelText('Message'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    // The mock server reports one receiver, which the page says plainly.
    expect(await screen.findByText('Delivered to 1 subscriber')).toBeInTheDocument();
  });

  it('stops listening when asked', async () => {
    const user = userEvent.setup();
    openPage(notifications);
    await user.type(screen.getByLabelText('Channels'), 'news');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    await screen.findByText('Currently listening');

    await user.click(screen.getByRole('button', { name: 'Stop listening' }));

    await waitFor(() => expect(screen.queryByText('Currently listening')).not.toBeInTheDocument());
  });

  it('clears the feed without touching the subscription', async () => {
    const user = userEvent.setup();
    openPage(notifications);
    await user.type(screen.getByLabelText('Channels'), 'news');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    await screen.findByText('Currently listening');
    deliver(notifications, 'news', 'a message');
    await screen.findByText('a message');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(screen.queryByText('a message')).not.toBeInTheDocument());
    expect(screen.getByText('Currently listening')).toBeInTheDocument();
  });
});
