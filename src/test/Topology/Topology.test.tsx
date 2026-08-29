import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Topology } from '@app/Topology/Topology';
import { slotCount, TOTAL_SLOTS } from '@app/Topology/types';
import { render } from '@test/utils';

const openFor = (connectionId: number) =>
  render(<Topology />, {
    route: `/connections/${connectionId}/topology`,
    path: '/connections/:connectionId/topology',
  });

describe('slotCount', () => {
  it('adds up every range a node serves', () => {
    expect(
      slotCount({
        id: 'a',
        address: '',
        role: 'primary',
        isSelf: false,
        primaryId: null,
        slots: [
          { from: 0, to: 99 },
          { from: 200, to: 299 },
        ],
        linkState: 'connected',
        flags: [],
        migrations: [],
      }),
    ).toBe(200);
  });
});

/** The table of nodes, as opposed to the graph above it, which labels the same addresses. */
const nodesTable = (): HTMLElement => screen.getByRole('grid', { name: 'Cluster nodes' });

describe('Topology', () => {
  it('says a standalone server is one, rather than drawing an empty cluster', async () => {
    openFor(1);

    expect(await screen.findByText('A single server')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This target is not clustered and is not a sentinel. There is nothing more to draw.',
      ),
    ).toBeInTheDocument();
  });

  it('reports the flavor and version it detected', async () => {
    openFor(1);

    expect(await screen.findByText('redis')).toBeInTheDocument();
    expect(screen.getByText(/8\.10\.0/)).toBeInTheDocument();
  });

  it('lists what the server said it supports', async () => {
    openFor(1);

    expect(await screen.findByText('duplicate keys')).toBeInTheDocument();
    expect(screen.getByText('streams')).toBeInTheDocument();
    // Standalone, so the cluster feature is not among them.
    expect(screen.queryByText('cluster')).not.toBeInTheDocument();
  });

  it('lists the nodes of a clustered target', async () => {
    openFor(2);

    expect(await screen.findByText('3 nodes')).toBeInTheDocument();
    // Scoped to the table: the graph above draws the same addresses as its node labels.
    const table = nodesTable();
    expect(within(table).getByText('127.0.0.1:7001')).toBeInTheDocument();
    expect(within(table).getByText('127.0.0.1:7002')).toBeInTheDocument();
  });

  it('draws each primary carrying the slots it serves', async () => {
    openFor(2);

    const graph = await screen.findByLabelText('Cluster topology');
    // The facts somebody opens a topology for are on the node itself rather than in the table
    // under it: which address, serving which slots, and how much of the keyspace that is.
    expect(within(graph).getByText('127.0.0.1:7001')).toBeInTheDocument();
    expect(within(graph).getByText('0–5460')).toBeInTheDocument();
    expect(within(graph).getByText('33%')).toBeInTheDocument();
    expect(within(graph).getByText('127.0.0.1:7002')).toBeInTheDocument();
    expect(within(graph).getByText('5461–16383')).toBeInTheDocument();
    expect(within(graph).getByText('67%')).toBeInTheDocument();
  });

  it('draws a replica in the colour of the primary it follows', async () => {
    openFor(2);

    const graph = await screen.findByLabelText('Cluster topology');
    // There are no boxes any more, so the colour is what says these two belong together — and it
    // is the same colour the slot bar gives that shard, which is the whole reason it is shared.
    const colourOf = (address: string) =>
      within(graph)
        .getByText(address)
        .closest<HTMLElement>('.keydra-graph__node')
        ?.style.getPropertyValue('--keydra-shard-color');

    expect(colourOf('127.0.0.1:7101')).toBe(colourOf('127.0.0.1:7001'));
    expect(colourOf('127.0.0.1:7101')).not.toBe(colourOf('127.0.0.1:7002'));
  });

  it('opens with what the cluster says about itself', async () => {
    openFor(2);

    // The cluster's own verdict, which the node list cannot give: every slot can be assigned
    // while the cluster refuses every request.
    expect(await screen.findByText('State')).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.getByText('16384 of 16384')).toBeInTheDocument();
  });

  it('says when a shard has nobody to take over from it', async () => {
    openFor(2);

    // Two shards, one replica between them. The one without is the risk worth being told about,
    // and it is the thing this page said nothing about before.
    expect(await screen.findByText('1 shard has no replica')).toBeInTheDocument();
    expect(
      screen.getByText(
        'If one of those primaries goes, the slots it serves go with it and nothing can take over. Add a replica to each, or accept the loss knowingly.',
      ),
    ).toBeInTheDocument();
  });

  it('says the whole keyspace is served when it is', async () => {
    openFor(2);

    // The two nodes cover 0–16383 between them, which is the thing worth knowing.
    expect(await screen.findByText(`All ${TOTAL_SLOTS} slots are served.`)).toBeInTheDocument();
  });

  it('marks which node answered the question', async () => {
    openFor(2);

    await screen.findByText('3 nodes');
    const row = within(nodesTable()).getByText('127.0.0.1:7001').closest<HTMLElement>('tr')!;
    expect(within(row).getByText('connected to')).toBeInTheDocument();
  });

  it('shows each node’s share of the keyspace', async () => {
    openFor(2);

    // 5461 of 16384 slots.
    expect(await screen.findByText('33.3%')).toBeInTheDocument();
  });
});
