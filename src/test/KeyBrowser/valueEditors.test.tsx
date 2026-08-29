import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { server } from '@mocks/node';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/**
 * The editors for the shapes a hash and a string do not cover.
 *
 * <p>Driven through the browser rather than by mounting each editor: an editor is only correct if
 * the mutation it sends is the one the server understands, and the panel between them is what turns
 * a click into that mutation. Each test therefore checks the request that left, not the row that
 * changed — the row changes because the query refetches, which proves nothing about the write.
 */
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

describe('value editors', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
  });

  describe('list', () => {
    it('pushes a new element onto the end', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'queue:jobs');

      await user.type(await screen.findByLabelText('New element'), 'third');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      // Which end matters: a list is ordered, and pushing to the wrong one puts the
      // newest job where the oldest should be.
      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'pushListElement',
          key: 'queue:jobs',
          value: 'third',
          toHead: false,
        }),
      );
    });

    it('edits an element by its index rather than by its value', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'queue:jobs');

      // The element is named by its index, which is the only thing that names one element
      // rather than a set of them: a list may hold the same value twice.
      await user.click(await screen.findByRole('button', { name: 'Edit 1' }));
      const input = screen.getByRole('textbox', { name: 'Edit 1' });
      await user.clear(input);
      await user.type(input, 'changed');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'setListElement',
          key: 'queue:jobs',
          index: 1,
          value: 'changed',
        }),
      );
    });

    it('deletes an element', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'queue:jobs');

      await user.click(
        await screen.findByRole('button', { name: 'Delete the element at index 0' }),
      );

      // By index rather than by value: a list may hold the same text twice, and removal by
      // value takes the first match, which is a row other than the one clicked.
      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'removeListElementAt',
          key: 'queue:jobs',
          index: 0,
        }),
      );
    });
  });

  describe('set', () => {
    it('adds a member', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'tags:post:1');

      await user.type(await screen.findByLabelText('New member'), 'keydb');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'addSetMember',
          key: 'tags:post:1',
          member: 'keydb',
        }),
      );
    });

    it('removes a member by name, because a set has no positions', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'tags:post:1');

      await user.click(await screen.findByRole('button', { name: 'Remove member valkey' }));

      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'removeSetMember',
          key: 'tags:post:1',
          member: 'valkey',
        }),
      );
    });
  });

  describe('sorted set', () => {
    it('adds a member with its score', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'leaderboard:global');

      await user.type(await screen.findByLabelText('New member'), 'carol');
      const score = screen.getByLabelText('Score for the new member');
      await user.clear(score);
      await user.type(score, '30');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      // The score is a number on the wire: sent as text it sorts lexically, and 9 comes
      // after 10.
      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'addScoredMember',
          key: 'leaderboard:global',
          member: 'carol',
          score: 30,
        }),
      );
    });

    it('will not add a member whose score is not a number', async () => {
      const user = userEvent.setup();
      await openBrowser();
      await openKey(user, 'leaderboard:global');

      await user.type(await screen.findByLabelText('New member'), 'dave');
      const score = screen.getByLabelText('Score for the new member');
      await user.clear(score);
      await user.type(score, 'soon');

      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });

    it('removes a member', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'leaderboard:global');

      await user.click(await screen.findByRole('button', { name: 'Remove member bob' }));

      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'removeScoredMember',
          key: 'leaderboard:global',
          member: 'bob',
        }),
      );
    });
  });

  describe('stream', () => {
    it('appends an entry and lets the server mint its id', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'events:signup');

      await user.type(await screen.findByLabelText('Field name 1'), 'kind');
      await user.type(screen.getByLabelText('Field value 1'), 'deleted');
      await user.click(screen.getByRole('button', { name: 'Append entry' }));

      // A stream's ids must increase, and a hand-typed one that does not is refused —
      // so the id is null and the server chooses.
      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'addStreamEntry',
          key: 'events:signup',
          id: null,
          fields: { kind: 'deleted' },
        }),
      );
    });

    it('shows an entry’s fields only when the row is expanded', async () => {
      const user = userEvent.setup();
      await openBrowser();
      await openKey(user, 'events:signup');

      // Collapsed, the row says how many fields there are rather than listing them. The
      // fields are in the document either way — PatternFly hides the expanded row rather
      // than unmounting it — so this asks whether they can be seen, not whether they exist.
      expect(await screen.findByText('1 field')).toBeInTheDocument();
      const table = screen.getByRole('grid', { name: 'Stream entries' });
      expect(within(table).getByText('created')).not.toBeVisible();

      await user.click(within(table).getByRole('button', { name: /Details/ }));

      expect(within(table).getByText('created')).toBeVisible();
    });

    it('deletes an entry by its id', async () => {
      const user = userEvent.setup();
      const sent = captureMutations();
      await openBrowser();
      await openKey(user, 'events:signup');

      await user.click(await screen.findByRole('button', { name: 'Delete entry 1-0' }));

      await waitFor(() =>
        expect(sent).toContainEqual({
          operation: 'deleteStreamEntry',
          key: 'events:signup',
          id: '1-0',
        }),
      );
    });
  });
});
