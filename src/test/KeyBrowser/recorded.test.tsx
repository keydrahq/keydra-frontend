import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { GraphQLRefusal, graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/**
 * An operation that was recorded rather than performed.
 *
 * <p>The helper that recognises one is tested on its own; this is the wiring, which is the half
 * that decides what somebody sees. Every answer on the GraphQL surface is 200, so the difference
 * between "recorded, and waiting for a second person" and "that failed" is a code — and getting
 * this branch wrong paints a working guard as a fault, which is the shape of message people learn
 * to click past.
 */
describe('an operation that needs a second person', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
  });

  const openBrowser = async () => {
    render(
      <NotificationProvider>
        <KeyBrowser />
      </NotificationProvider>,
      { route: '/connections/1/keys', path: '/connections/:connectionId/keys' },
    );
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
    act(() => FakeEventSource.latest().replayMatching());
    await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());
  };

  const deleteOneKey = async (user: ReturnType<typeof userEvent.setup>) => {
    const row = screen.getByText('session:abc').closest<HTMLElement>('[role="row"]')!;
    await user.click(within(row).getByRole('button', { name: 'Actions for session:abc' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
  };

  it('says it was recorded rather than that it failed', async () => {
    server.use(
      graphqlWith({
        DeleteKeys: () => {
          throw new GraphQLRefusal(
            'approval-required',
            'orders-prod is a target that nobody empties on their own. This has been recorded' +
              ' and needs somebody else to agree before it happens.',
          );
        },
      }),
    );
    const user = userEvent.setup();
    await openBrowser();

    await deleteOneKey(user);

    expect(await screen.findByText('Recorded, not done')).toBeInTheDocument();
    expect(screen.getByText(/nobody empties on their own/)).toBeInTheDocument();
    // And the dialog is closed, because the request was accepted: leaving it open would ask
    // somebody to press the button again on an operation that is already written down.
    await waitFor(() => expect(screen.queryByText(/will be deleted/)).not.toBeInTheDocument());
  });

  it('still says a real refusal is one', async () => {
    server.use(
      graphqlWith({
        DeleteKeys: () => {
          // No code: the ordinary refusals only have a sentence, and this branch must not
          // swallow them into good news.
          throw new Error('Deleting keys needs keys:delete on this target');
        },
      }),
    );
    const user = userEvent.setup();
    await openBrowser();

    await deleteOneKey(user);

    expect(await screen.findByText('The keys were not deleted')).toBeInTheDocument();
    expect(screen.queryByText('Recorded, not done')).not.toBeInTheDocument();
  });
});
