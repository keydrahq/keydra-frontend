import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { ConnectionDetail } from '@app/Connections/ConnectionDetail';
import { server } from '@mocks/node';
import { render } from '@test/utils';

/** One roster row, with only the fields this page reads varying. */
const instance = (id: string, watching: number[]) => ({
  id,
  version: '0.1.0-SNAPSHOT',
  commit: 'abc1234',
  startedAt: '2026-08-24T00:00:00Z',
  lastSeenAt: '2026-08-24T00:05:00Z',
  leader: id === 'keydra-one',
  self: id === 'keydra-one',
  published: 0,
  received: 0,
  commands: 0,
  sockets: 0,
  streams: 0,
  jobs: 0,
  watching,
});

/**
 * Which Keydras hold a client to this target.
 *
 * <p>The roster read the other way round, and shown only when the answer is more than one: on the
 * single instance almost every deployment runs, "held by 1 instance" is true, useless, and on every
 * target page. What is worth surfacing is the other case — two Keydras are two pools against this
 * server.
 */
describe('ConnectionDetail holders', () => {
  const mount = () =>
    render(<ConnectionDetail />, {
      route: '/connections/1',
      path: '/connections/:connectionId',
    });

  it('says how many instances hold the target when more than one does', async () => {
    server.use(
      http.get('/api/v1/instances/roster', () =>
        HttpResponse.json([instance('keydra-one', [1, 2]), instance('keydra-two', [1])]),
      ),
    );

    mount();

    await waitFor(() => {
      expect(screen.getByText(/held by 2 instances/)).toBeInTheDocument();
    });
  });

  it('says nothing where one instance holds it, which is every ordinary deployment', async () => {
    server.use(
      http.get('/api/v1/instances/roster', () =>
        HttpResponse.json([instance('keydra-one', [1, 2])]),
      ),
    );

    mount();

    // The name is in the breadcrumb as well as the heading, so this waits on both rather than
    // asserting which one arrives first.
    await screen.findAllByText('local-redis');
    expect(screen.queryByText(/held by/)).not.toBeInTheDocument();
  });

  it('says nothing where no instance reports holding it', async () => {
    server.use(http.get('/api/v1/instances/roster', () => HttpResponse.json([])));

    mount();

    // The name is in the breadcrumb as well as the heading, so this waits on both rather than
    // asserting which one arrives first.
    await screen.findAllByText('local-redis');
    expect(screen.queryByText(/held by/)).not.toBeInTheDocument();
  });
});
