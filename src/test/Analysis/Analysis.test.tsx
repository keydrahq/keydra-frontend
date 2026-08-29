import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Analysis } from '@app/Analysis/Analysis';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

const open = () =>
  render(<Analysis />, {
    route: '/connections/1/analysis',
    path: '/connections/:connectionId/analysis',
  });

describe('Analysis', () => {
  it('says whether the numbers are a census or an estimate', async () => {
    open();

    // How far to trust everything below decides how to read it, so it comes first.
    expect(await screen.findByText('All 8 keys were measured.')).toBeInTheDocument();
  });

  it('states the never-expiring share as a finding rather than a number to work out', async () => {
    open();

    // Six of eight, which is the single most common way a server fills up without
    // anybody doing anything wrong.
    expect(await screen.findByText('75% of the sampled keys have no expiry')).toBeInTheDocument();
  });

  it('groups the memory by namespace, largest first', async () => {
    open();

    const table = await screen.findByRole('grid', { name: 'Memory by namespace' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('user')).toBeInTheDocument();
  });

  it('marks a namespace where nothing expires at all', async () => {
    open();

    const table = await screen.findByRole('grid', { name: 'Memory by namespace' });
    const user = within(table).getByText('user').closest<HTMLElement>('tr')!;
    // Both of the namespace's keys, which is what makes it the one to look at — and it is
    // marked rather than merely counted, because "all of them" is the finding.
    const noExpiry = within(user).getAllByRole('cell').at(-1)!;
    expect(noExpiry).toHaveTextContent('2');
    expect(noExpiry.querySelector('.pf-m-orange')).not.toBeNull();
  });

  it('says there is nothing to account for rather than drawing an empty chart', async () => {
    server.use(
      graphqlWith({
        KeyspaceReport: () => ({
          keyspaceReport: {
            sampled: 0,
            keysInDatabase: 0,
            bytesSampled: 0,
            namespaces: [],
            types: [],
            expiry: [],
            largest: [],
          },
        }),
      }),
    );

    open();

    expect(await screen.findByText('Nothing to measure')).toBeInTheDocument();
  });
});
