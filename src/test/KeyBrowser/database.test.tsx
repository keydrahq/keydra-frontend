import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

const openBrowser = async (search = '') => {
  render(
    <NotificationProvider>
      <KeyBrowser />
    </NotificationProvider>,
    {
      route: `/connections/1/keys${search}`,
      path: '/connections/:connectionId/keys',
    },
  );
  await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
  act(() => FakeEventSource.latest().replayMatching());
};

describe('database switching', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
  });

  it('opens in the database the profile says, without naming it in the URL', async () => {
    await openBrowser();

    // Nothing chosen means the profile's own, which the server already knows: sending a
    // db of its own would override a profile that opens somewhere else.
    expect(FakeEventSource.latest().url).not.toContain('db=');
  });

  it('offers every database with what is in it', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await user.click(await screen.findByRole('button', { name: 'Choose a database' }));

    const menu = await screen.findByRole('listbox');
    // An empty database is still offered: a list that hid them could not be used to move
    // into one.
    expect(within(menu).getByText('db3')).toBeInTheDocument();
    expect(within(menu).getAllByText('empty').length).toBeGreaterThan(0);
    expect(within(menu).getByText('3 keys')).toBeInTheDocument();
  });

  it('walks the chosen database and says so in the address', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await user.click(await screen.findByRole('button', { name: 'Choose a database' }));
    await user.click(await screen.findByRole('option', { name: /db3/ }));

    await waitFor(() => expect(FakeEventSource.latest().url).toContain('db=3'));
  });

  it('starts a new scan rather than adding to the one on screen', async () => {
    const user = userEvent.setup();
    await openBrowser();
    await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());

    await user.click(await screen.findByRole('button', { name: 'Choose a database' }));
    await user.click(await screen.findByRole('option', { name: /db3/ }));

    // The keys on screen belong to the other keyspace; carrying them over would show one
    // database's contents under another's heading.
    await waitFor(() => expect(screen.queryByText('user:1:profile')).not.toBeInTheDocument());
  });

  it('reads the database out of the address, so a link to one is a link', async () => {
    await openBrowser('?db=3');

    expect(FakeEventSource.latest().url).toContain('db=3');
  });
});
