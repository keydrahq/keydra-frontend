import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Overview } from '@app/Overview/Overview';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

const open = () => render(<Overview />, { route: '/overview', path: '/overview' });

describe('Overview: what needs attention', () => {
  it('says nothing is wrong rather than showing an empty list', async () => {
    // A fleet with nothing to report: one target, answering, and nothing arranged that failed.
    server.use(
      graphqlWith({
        Connections: () => ({
          connections: [
            {
              id: 1,
              name: 'local-redis',
              host: 'localhost',
              port: 6379,
              username: null,
              hasPassword: false,
              tls: false,
              database: 0,
              engine: 'RESP',
              flavor: 'REDIS',
              type: 'STANDALONE',
              sentinelMasterName: null,
              notes: null,
              tunnelId: null,
              status: { state: 'UP', message: null, server: null, checkedAt: null },
            },
          ],
        }),
        Attention: () => ({ alertRules: [], scheduleRuns: [], migrations: { nodes: [] } }),
      }),
    );

    open();

    // An empty panel and a healthy fleet look identical otherwise, and one of them is worth
    // knowing.
    expect(await screen.findByText('Nothing is asking for attention')).toBeInTheDocument();
  });

  it('names a target that has stopped answering', async () => {
    open();

    // Every unreachable target is its own line, because "3 targets are not answering" is the
    // sentence that gets somebody looking at the wrong one.
    const row = (await screen.findByText('Not answering')).closest<HTMLElement>('tr')!;
    expect(within(row).getByText('local-valkey')).toBeInTheDocument();
  });

  it('says several of one kind once', async () => {
    server.use(
      graphqlWith({
        Attention: () => ({
          alertRules: [],
          scheduleRuns: [],
          migrations: {
            nodes: [1, 2, 3].map((id) => ({
              id: `job-${id}`,
              sourceConnectionId: 1,
              targetConnectionId: 2,
              match: '*',
              scanned: 0,
              migrated: 0,
              skipped: 0,
              failed: 0,
              deleted: 0,
              reason: null,
              state: 'INTERRUPTED',
              startedAt: new Date(id * 1000).toISOString(),
              finishedAt: new Date(id * 2000).toISOString(),
              startedBy: 'ada',
            })),
          },
        }),
      }),
    );

    open();

    await waitFor(() =>
      expect(screen.getByText('A migration was interrupted')).toBeInTheDocument(),
    );
    const row = screen.getByText('A migration was interrupted').closest<HTMLElement>('tr')!;
    // One broken schedule produces one of these every five minutes, and a panel listing each
    // is a panel where the other thing that went wrong is below the fold.
    expect(within(row).getByText('and 2 more')).toBeInTheDocument();
  });
});
