import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Migrations } from '@app/Migrations/Migrations';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

const open = () => render(<Migrations />, { route: '/migrations', path: '/migrations' });

describe('Migrations', () => {
  it('names both ends of a job rather than their ids', async () => {
    open();

    // A job is between two targets, and neither of them is a number to the person reading.
    const row = (await screen.findByText('local-redis')).closest<HTMLElement>('tr')!;
    expect(within(row).getByText('local-valkey')).toBeInTheDocument();
  });

  it('reports what a job has handled when nothing can say how much there is', async () => {
    open();

    /*
     * This job moves a glob, and a store cannot say how many keys match one without walking the
     * keyspace — which is the job. So there is no denominator, no bar is drawn, and what is shown
     * is the count itself: 90 moved plus 4 already there.
     *
     * What used to be here measured the bar as migrated over scanned, which is a composition
     * rather than a progress: every key already on the target came off the top of it, so a
     * migration that did exactly what was asked of it drew a bar short of the end.
     */
    expect(await screen.findByText('94 keys')).toBeInTheDocument();
  });

  it('says how many were left alone and how many were refused', async () => {
    open();

    expect(await screen.findByText('4 already there, 0 refused')).toBeInTheDocument();
  });

  it('says nothing has moved rather than showing an empty table', async () => {
    // The page reads the GraphQL surface now, so an empty list is an empty `data`.
    server.use(
      graphqlWith({
        MigrationsPage: () => ({
          migrations: {
            totalCount: 0,
            running: 0,
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false, hasPreviousPage: false },
          },
        }),
      }),
    );

    open();

    expect(await screen.findByText('Nothing has moved yet')).toBeInTheDocument();
  });
});
