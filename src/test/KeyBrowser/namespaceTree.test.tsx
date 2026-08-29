import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/**
 * What the tree says when it has only seen part of the keyspace.
 *
 * <p>Measured rather than imagined: against nine hundred and forty thousand keys the tree drew
 * five namespaces of the seven that were there, because the walk stops at a sample. Every count
 * already said "at least this many", which is true and is not the whole truth — a level that was
 * sampled can be missing a branch entirely, and a tooltip on a total cannot say that, because
 * what is absent has no row to hang one on.
 */
describe('the namespace tree', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
  });

  const openBrowser = async () => {
    render(<KeyBrowser />, {
      route: '/connections/1/keys',
      path: '/connections/:connectionId/keys',
    });
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
    act(() => FakeEventSource.latest().replayMatching());
    await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());
  };

  it('says the namespaces are a sample when the walk stopped early', async () => {
    server.use(
      graphqlWith({
        NamespaceTree: () => ({
          namespaceTree: [
            { name: 'cache', prefix: 'cache:', keyCount: 4257, hasChildren: true, partial: true },
            { name: 'user', prefix: 'user:', keyCount: 1586, hasChildren: true, partial: true },
          ],
        }),
      }),
    );
    await openBrowser();

    expect(
      await screen.findByText(/These namespaces come from a sample of the keyspace/),
    ).toBeInTheDocument();
  });

  it('says nothing when the walk saw the whole keyspace', async () => {
    await openBrowser();

    // The fixture holds a handful of keys and the walk reaches the end of them, so there is
    // nothing to warn about — and a warning on every keyspace is one nobody reads on the one
    // where it is true.
    await screen.findByText('cache');
    expect(
      screen.queryByText(/These namespaces come from a sample of the keyspace/),
    ).not.toBeInTheDocument();
  });
});
