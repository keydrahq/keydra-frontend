import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

describe('creating a key', () => {
  let written: unknown[];
  let expiries: unknown[];

  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
    written = [];
    expiries = [];

    server.use(
      http.post('/api/v1/connections/:id/value', async ({ request }) => {
        written.push(await request.json());
        return HttpResponse.json({ affected: 1 });
      }),
      graphqlWith({
        ExpireKey: (variables) => {
          expiries.push(variables.expire);
          return { expireKey: { affected: 1 } };
        },
      }),
    );
  });

  const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
    render(
      <NotificationProvider>
        <KeyBrowser />
      </NotificationProvider>,
      { route: '/connections/1/keys', path: '/connections/:connectionId/keys' },
    );
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
    act(() => FakeEventSource.latest().replayMatching());
    await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'New key' }));
    await screen.findByRole('dialog');
  };

  it('creates a string by writing its first value', async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(screen.getByRole('textbox', { name: 'Key name' }), 'greeting');
    await user.type(screen.getByRole('textbox', { name: 'Value' }), 'hello');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ operation: 'setString', key: 'greeting', value: 'hello' });
    // No expiry was asked for, so none is set — a second call would be a key that
    // silently disappears later.
    expect(expiries).toHaveLength(0);
  });

  it('asks for a field name when the key is a hash', async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(screen.getByRole('textbox', { name: 'Key name' }), 'user:9:profile');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'hash');

    // A hash cannot be created without saying which field is being written.
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Field' }), 'name');
    await user.type(screen.getByRole('textbox', { name: 'Value of that field' }), 'ada');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({
      operation: 'setHashField',
      key: 'user:9:profile',
      field: 'name',
      value: 'ada',
    });
  });

  it('sets the expiry after the key exists, when one was given', async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(screen.getByRole('textbox', { name: 'Key name' }), 'session:new');
    await user.type(screen.getByRole('textbox', { name: 'Value' }), 'token');
    await user.type(screen.getByRole('spinbutton', { name: /Expires in/ }), '60');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(expiries).toHaveLength(1));
    expect(expiries[0]).toEqual({ key: 'session:new', ttlSeconds: 60 });
  });

  it('starts the name from the namespace the tree is showing', async () => {
    const user = userEvent.setup();
    render(
      <NotificationProvider>
        <KeyBrowser />
      </NotificationProvider>,
      { route: '/connections/1/keys', path: '/connections/:connectionId/keys' },
    );
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
    act(() => FakeEventSource.latest().replayMatching());
    await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());

    // Picking a namespace in the tree is a statement about where you are working.
    await user.click(await screen.findByText('user'));
    await user.click(screen.getByRole('button', { name: 'New key' }));

    expect(await screen.findByRole('textbox', { name: 'Key name' })).toHaveValue('user:');
  });
});
