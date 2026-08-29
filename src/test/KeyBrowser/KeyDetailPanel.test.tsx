import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { server } from '@mocks/node';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/** Opens the browser and lets the seeded scan finish. */
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

/** Captures the bodies of every value mutation the panel sends. */
const captureMutations = (): unknown[] => {
  const sent: unknown[] = [];
  server.use(
    http.post('/api/v1/connections/:id/value', async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json({ affected: 1 });
    }),
  );
  return sent;
};

const openKey = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name }));
  return await screen.findByRole('heading', { name });
};

describe('KeyDetailPanel', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
  });

  it('opens a key’s value beside the list rather than instead of it', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await openKey(user, 'user:1:profile');

    // The hash arrived and is shown field by field.
    expect(await screen.findByText('city')).toBeInTheDocument();
    expect(screen.getByText('izmir')).toBeInTheDocument();
    // The keyspace is still there: the point of a drawer over a page.
    expect(screen.getByText('session:abc')).toBeInTheDocument();
  });

  it('edits a hash field in place', async () => {
    const user = userEvent.setup();
    const sent = captureMutations();
    await openBrowser();
    await openKey(user, 'user:1:profile');

    await user.click(await screen.findByRole('button', { name: 'Edit city' }));
    const input = screen.getByRole('textbox', { name: 'Edit city' });
    await user.clear(input);
    await user.type(input, 'ankara');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(sent).toContainEqual({
        operation: 'setHashField',
        key: 'user:1:profile',
        field: 'city',
        value: 'ankara',
      }),
    );
  });

  it('adds a hash field from the row above the table', async () => {
    const user = userEvent.setup();
    const sent = captureMutations();
    await openBrowser();
    await openKey(user, 'user:1:profile');

    await user.type(await screen.findByLabelText('New field name'), 'role');
    await user.type(screen.getByLabelText('New field value'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(sent).toContainEqual({
        operation: 'setHashField',
        key: 'user:1:profile',
        field: 'role',
        value: 'admin',
      }),
    );
  });

  it('deletes a hash field', async () => {
    const user = userEvent.setup();
    const sent = captureMutations();
    await openBrowser();
    await openKey(user, 'user:1:profile');

    await user.click(await screen.findByRole('button', { name: 'Delete field city' }));

    await waitFor(() =>
      expect(sent).toContainEqual({
        operation: 'deleteHashField',
        key: 'user:1:profile',
        field: 'city',
      }),
    );
  });

  it('saves a string only when it has been changed', async () => {
    const user = userEvent.setup();
    const sent = captureMutations();
    await openBrowser();
    await openKey(user, 'session:abc');

    const area = await screen.findByRole('textbox', { name: 'String value' });
    const save = screen.getByRole('button', { name: 'Save' });
    // Nothing has changed yet, so there is nothing to save.
    expect(save).toBeDisabled();

    await user.clear(area);
    await user.type(area, 'goodbye');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(sent).toContainEqual({
        operation: 'setString',
        key: 'session:abc',
        value: 'goodbye',
      }),
    );
  });

  it('says so when the key has gone rather than showing an error page', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/v1/connections/:id/value', () =>
        HttpResponse.json({ message: 'gone' }, { status: 404 }),
      ),
    );
    await openBrowser();

    await openKey(user, 'user:1:profile');

    expect(await screen.findByText('This key no longer exists')).toBeInTheDocument();
  });

  it('closes and leaves the list as it was', async () => {
    const user = userEvent.setup();
    await openBrowser();
    await openKey(user, 'user:1:profile');

    await user.click(screen.getByRole('button', { name: 'Close drawer panel' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'user:1:profile' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('user:1:profile')).toBeInTheDocument();
  });

  it('offers the value as a redis-cli command', async () => {
    const user = userEvent.setup();
    const copied: string[] = [];
    // navigator.clipboard is a getter-only property in jsdom, so it is defined rather
    // than assigned.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) },
    });
    await openBrowser();
    await openKey(user, 'user:1:profile');

    await user.click(screen.getByRole('button', { name: 'Key actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy as redis-cli command' }));

    await waitFor(() =>
      expect(copied).toContain('HSET "user:1:profile" "name" "alice" "city" "izmir"'),
    );
  });
});
