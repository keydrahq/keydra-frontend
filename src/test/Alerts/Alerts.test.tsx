import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alerts } from '@app/Alerts/Alerts';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

const open = () => render(<Alerts />, { route: '/alerts', path: '/alerts' });

describe('Alerts', () => {
  it('shows what a firing rule fired on, not just that it is firing', async () => {
    open();

    const row = (await screen.findByText('Memory filling up')).closest<HTMLElement>('tr')!;
    expect(within(row).getByText('firing')).toBeInTheDocument();
    // The reading beside the state: "firing" without the number sends somebody elsewhere
    // to find out what fired.
    expect(within(row).getByText('91.5%')).toBeInTheDocument();
    expect(within(row).getByText(/Memory against its ceiling/)).toBeInTheDocument();
  });

  it('says what a rule written against the past compares with, and what that came to', async () => {
    open();

    const row = (await screen.findByText('Memory filling up')).closest<HTMLElement>('tr')!;
    // A percentage on its own is a number somebody has to go and look up; the baseline
    // beside it is the half of the sentence that makes it mean something.
    expect(within(row).getByText(/140% of The same hour last week/)).toBeInTheDocument();
    expect(within(row).getByText(/62\.5%/)).toBeInTheDocument();
  });

  it('says a rule with nowhere to send is still recorded here', async () => {
    open();

    const row = (await screen.findByText('Unreachable')).closest<HTMLElement>('tr')!;
    expect(within(row).getByText('in Keydra only')).toBeInTheDocument();
    // A condition has no threshold worth showing: "not answering, above 0" is not a
    // sentence anybody means.
    expect(within(row).queryByText(/above 0/)).not.toBeInTheDocument();
  });

  it('records only transitions in the history', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'History' }));

    expect(await screen.findByText('started firing')).toBeInTheDocument();
    expect(screen.getByText('On-call channel')).toBeInTheDocument();
  });

  it('never shows a webhook address, only its host', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Deliveries' }));

    // The path of a Slack or Discord webhook is the credential. The API answers with the
    // host and a "yes, one is stored", and the page can therefore show nothing else.
    expect(await screen.findByText('hooks.slack.com')).toBeInTheDocument();
    expect(screen.queryByText(/hooks\.slack\.com\/services/)).not.toBeInTheDocument();
  });

  it('says nothing is being watched for rather than showing an empty table', async () => {
    server.use(
      graphqlWith({
        AlertsPage: () => ({
          alertRules: [],
          alertMetrics: [],
          alertDeliveries: [],
          connections: [],
        }),
      }),
    );

    open();

    expect(await screen.findByText('Nothing is being watched for')).toBeInTheDocument();
  });
});
