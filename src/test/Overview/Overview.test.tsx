import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Overview } from '@app/Overview/Overview';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

const open = () => render(<Overview />, { route: '/', path: '/' });

describe('Overview', () => {
  it('says how much of the fleet is answering', async () => {
    open();

    // One profile in the fixtures is down, which is the number worth being told first.
    expect(await screen.findByText('1/2')).toBeInTheDocument();
  });

  it('adds up only the targets that reported', async () => {
    open();

    // The unreachable profile contributes nothing rather than a zero, and the label says
    // how many the total is actually over.
    // Both the key total and the memory total carry the same qualifier, which is the point:
    // neither is a total over the whole fleet.
    expect(await screen.findAllByText('across 1 target that reported')).toHaveLength(2);
  });

  it('lists every target, reachable or not, with a way into it', async () => {
    open();

    const table = await screen.findByRole('grid', { name: 'Targets' });
    expect(within(table).getByRole('link', { name: 'local-redis' })).toHaveAttribute(
      'href',
      '/connections/1/keys',
    );
    // The one that is down is still listed: a fleet view that hid it would be answering a
    // different question.
    expect(within(table).getByRole('link', { name: 'local-valkey' })).toBeInTheDocument();
  });

  it('says nothing has been saved yet rather than showing an empty table', async () => {
    server.use(graphqlWith({ Connections: () => ({ connections: [] }) }));

    open();

    expect(await screen.findByText('Nothing to watch yet')).toBeInTheDocument();
  });

  it('draws a memory bar only for a target that has a ceiling', async () => {
    open();

    const table = await screen.findByRole('grid', { name: 'Targets' });
    // The reading has to have landed, or the spinner standing in for it is what gets found.
    const memory = await within(table).findByText(/MiB/);

    // Without a configured limit the proportion is undefined rather than zero, so the
    // figure stands on its own rather than filling a bar to an imaginary ceiling.
    expect(memory.closest('.pf-v6-c-progress')).toBeNull();
  });
});
