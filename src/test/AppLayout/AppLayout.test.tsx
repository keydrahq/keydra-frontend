import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { ConnectionDetail } from '@app/Connections/ConnectionDetail';
import { render } from '@test/utils';

/**
 * The side navigation.
 *
 * <p>Found including hidden elements: jsdom reports every element as zero-sized, so PatternFly's
 * page decides it is on a small screen and collapses the sidebar. The markup is all there, which
 * is what these tests are about.
 */
const nav = () => screen.getByRole('navigation', { hidden: true });

describe('AppLayout', () => {
  it('offers the global pages and nothing that belongs to one target', async () => {
    render(<AppLayout />, { route: '/connections/1/keys' });

    await waitFor(() => expect(within(nav()).getByText('Connections')).toBeInTheDocument());

    // A target's tools are on the target's own page. A sidebar that grows a second group
    // once you are inside a connection answers "which view am I in" in the place that is
    // supposed to answer "where in the application am I".
    expect(within(nav()).queryByText('Keys')).not.toBeInTheDocument();
    expect(within(nav()).queryByText('Console')).not.toBeInTheDocument();
  });

  it('keeps the connections entry current while a target is open', async () => {
    render(<AppLayout />, { route: '/connections/1/console' });

    await waitFor(() => expect(within(nav()).getByText('Connections')).toBeInTheDocument());
    expect(within(nav()).getByText('Connections').closest('a')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('ConnectionDetail', () => {
  it('names the target and offers its tools as tabs', async () => {
    render(<ConnectionDetail />, {
      route: '/connections/1/keys',
      path: '/connections/:connectionId/keys',
    });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'local-redis' })).toBeVisible());

    const tabs = screen.getByRole('navigation', { name: 'Connection tools' });
    for (const tool of ['Keys', 'Console', 'Pub/Sub', 'Monitoring', 'Topology']) {
      expect(within(tabs).getByText(tool)).toBeInTheDocument();
    }
    expect(within(tabs).getByText('Console').closest('a')).toHaveAttribute(
      'href',
      '/connections/1/console',
    );
  });

  it('says where the target is and what it is holding', async () => {
    render(<ConnectionDetail />, {
      route: '/connections/1/keys',
      path: '/connections/:connectionId/keys',
    });

    await waitFor(() => expect(screen.getByText('redis://localhost:6379')).toBeInTheDocument());
    // The figures come from one reading taken on request, not from a running sampler, so
    // they arrive after the address rather than with it.
    expect(await screen.findByText(/4 keys/)).toBeInTheDocument();
  });
});
