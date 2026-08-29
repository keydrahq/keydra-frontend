import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Instances } from '@app/Instances/Instances';
import { instanceFixture } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

/**
 * What an instance is holding, as the page reports it.
 *
 * <p>The graph beside this table is drawing rather than logic and is left alone, per the rule about
 * not chasing coverage on layout. What is asserted here is the part that decides something: the
 * three numbers are shown even when they are zero, and the list of targets is reachable in full
 * rather than truncated into a cell.
 */
describe('Instances', () => {
  /**
   * The roster table, not the page.
   *
   * <p>The graph above it draws the same instance by the same name, so a query across the whole
   * page finds two of everything. Scoping to the table is what makes these assertions about the
   * roster rather than about which of the two happened to render first.
   */
  const roster = async () => {
    const table = await screen.findByRole('grid', { name: 'Running instances' });
    return within(table);
  };

  it('says how much each instance is holding', async () => {
    render(<Instances />);

    const table = await roster();
    await waitFor(() => {
      expect(table.getByText('keydra-mock')).toBeInTheDocument();
    });

    // This instance's row rather than the table: an instance that has stopped holds nothing, so
    // its three zeros are correct and would otherwise answer for this one's.
    const row = table.getByText('keydra-mock').closest<HTMLElement>('tr')!;
    expect(within(row).getByText('3 sockets')).toBeInTheDocument();
    expect(within(row).getByText('1 stream')).toBeInTheDocument();
    // Zero is a real answer — an instance a balancer has stopped sending to — and hiding it
    // would make an idle instance look like a broken reading.
    expect(within(row).getByText('0 jobs')).toBeInTheDocument();
  });

  it('shows an instance that stopped without shutting down, rather than hiding it', async () => {
    render(<Instances />);

    const table = await roster();
    await waitFor(() => {
      expect(table.getByText('keydra-gone')).toBeInTheDocument();
    });

    // One that stopped cleanly takes its own row with it, so anything still listed and not
    // answering is either dying or dead — and the roster is the only record of it there is.
    const row = table.getByText('keydra-gone').closest<HTMLElement>('tr')!;
    expect(within(row).getByText('Not answering')).toBeInTheDocument();
    // Nothing to offer it: draining asks a running process to hand its work over.
    expect(within(row).queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
  });

  it('says what this deployment says twice, differently', async () => {
    server.use(
      http.get('/api/v1/instances', () =>
        HttpResponse.json({
          instances: [instanceFixture],
          dependencies: [],
          choresStoppedSince: null,
          deployment: [
            {
              setting: 'KEYDRA_BEHIND_PROXY',
              saying:
                'A request arrived through a proxy, and this instance is set not to believe it',
              costing: 'Every sign-in looks like it came from the proxy',
            },
          ],
        }),
      ),
    );
    render(<Instances />);

    // The setting to change and what it is costing, because a warning nobody can weigh is one
    // nobody acts on.
    expect(await screen.findByText(/A request arrived through a proxy/)).toBeInTheDocument();
    expect(screen.getByText('KEYDRA_BEHIND_PROXY')).toBeInTheDocument();
    expect(screen.getByText(/Every sign-in looks like it came from the proxy/)).toBeInTheDocument();
  });

  it('draws nothing at all when the deployment says nothing twice', async () => {
    render(<Instances />);

    await roster();
    // A panel that reports no problems every day is one nobody reads on the day it reports one.
    expect(screen.queryByText(/The setting to change/)).not.toBeInTheDocument();
  });

  it('says when something started and stopped answering', async () => {
    render(<Instances />);

    // Changes rather than answers: the row exists because something happened, which is what makes
    // the list short enough to read and worth more the older it gets.
    const row = (await screen.findByText('Stopped answering')).closest<HTMLElement>('tr')!;
    expect(within(row).getByText('nightly-s3')).toBeInTheDocument();
    expect(within(row).getByText('The credentials were refused')).toBeInTheDocument();
    expect(screen.getByText('Started answering')).toBeInTheDocument();
  });

  it('says when nothing is doing the scheduled work', async () => {
    server.use(
      http.get('/api/v1/instances', () =>
        HttpResponse.json({
          instances: [instanceFixture],
          dependencies: [],
          choresStoppedSince: '2026-08-24T02:00:00Z',
        }),
      ),
    );
    render(<Instances />);

    // The page would otherwise be confidently wrong in exactly one way: a healthy roster while
    // none of it does any work.
    expect(await screen.findByText('Nothing is doing the scheduled work')).toBeInTheDocument();
  });

  it('says nothing about the chores in the ordinary case', async () => {
    render(<Instances />);

    await roster();
    expect(screen.queryByText('Nothing is doing the scheduled work')).not.toBeInTheDocument();
  });

  it('names the targets an instance holds once the row is opened', async () => {
    render(<Instances />);

    const table = await roster();
    await waitFor(() => {
      expect(table.getByText('keydra-mock')).toBeInTheDocument();
    });

    // Closed to begin with: the list is context for the numbers rather than the first thing
    // somebody opening this page is looking for. Rendered but hidden, which is how the table
    // does it — the assertion is about what somebody can see, not about what is in the DOM.
    expect(table.getByText('local-redis')).not.toBeVisible();

    /*
     * By position rather than by name: the toggle takes its accessible name from the row it opens,
     * which the table wires up with aria-labelledby, so there is no literal to match on. It is the
     * first button in the row — the other one is the actions menu at the far end.
     */
    await userEvent.click(table.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(table.getByText('local-redis')).toBeVisible();
    });
    expect(table.getByText('local-valkey')).toBeVisible();
  });

  it('says whether an instance is in service', async () => {
    render(<Instances />);

    const table = await roster();
    await waitFor(() => {
      expect(table.getByText('keydra-mock')).toBeInTheDocument();
    });

    expect(table.getByText('serving')).toBeInTheDocument();
  });

  /**
   * The dialog names the instance, and says what stops.
   *
   * <p>Both matter for the same reason: a fleet is a list of names that look alike, and a
   * confirmation reading "this instance" is one somebody can agree to from the wrong row.
   */
  it('says what draining does before asking for it', async () => {
    const drained: string[] = [];
    server.use(
      http.post('/api/v1/instances/:id/drain', ({ params }) => {
        drained.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<Instances />);

    const table = await roster();
    await waitFor(() => {
      expect(table.getByText('keydra-mock')).toBeInTheDocument();
    });

    await user.click(table.getByRole('button', { name: 'Kebab toggle' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Drain' }));

    expect(await screen.findByText('Take keydra-mock out of service?')).toBeInTheDocument();
    // One instance running, so the dialog says what nobody will be doing afterwards.
    expect(screen.getByText(/only instance running/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Drain' }));
    await waitFor(() => {
      expect(drained).toEqual(['keydra-mock']);
    });
  });

  /** And putting one back takes no confirming: it gives nothing up. */
  it('puts a draining instance back without asking', async () => {
    const resumed: string[] = [];
    server.use(
      http.get('/api/v1/instances', () =>
        HttpResponse.json({
          instances: [{ ...instanceFixture, draining: true }],
          dependencies: [],
        }),
      ),
      http.delete('/api/v1/instances/:id/drain', ({ params }) => {
        resumed.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<Instances />);

    const table = await roster();
    await waitFor(() => {
      expect(table.getByText('draining')).toBeInTheDocument();
    });

    await user.click(table.getByRole('button', { name: 'Kebab toggle' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Put back into service' }));

    await waitFor(() => {
      expect(resumed).toEqual(['keydra-mock']);
    });
  });

  it('still lists the roster and what it rests on', async () => {
    render(<Instances />);

    await waitFor(() => {
      expect(screen.getByText('1 instance running')).toBeInTheDocument();
    });
    const dependencies = screen.getByRole('grid', { name: 'Keydra dependencies' });
    expect(within(dependencies).getByText('Database')).toBeInTheDocument();
  });

  /**
   * The reading phase 49 is for.
   *
   * <p>"Reachable" on its own is a claim about a moment nobody is in. What the page says instead is
   * what was found out, and when — which is something a person can decide how much to trust.
   */
  it('says what answered and how long ago that was found out', async () => {
    render(<Instances />);

    const row = within(await screen.findByRole('row', { name: /Backup destinations/ }));
    expect(row.getByText(/1 of 2 answering/)).toBeInTheDocument();
    expect(row.getByText(/checked .* ago/)).toBeInTheDocument();
  });

  it('offers to ask again, for the moment somebody has just changed something', async () => {
    const user = userEvent.setup();
    render(<Instances />);

    await user.click(await screen.findByRole('button', { name: 'Check now' }));

    // No assertion about what came back: the mock has no clock, and what this pins is that the
    // page offers the ask at all rather than making somebody wait ten minutes for the next one.
    expect(screen.getByRole('button', { name: 'Check now' })).toBeInTheDocument();
  });
});
