import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInTab } from '@app/Access/SignInTab';
import { graphqlWith, signInPolicyFixture } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

/**
 * The switch that requires a second factor of everybody.
 *
 * <p>What is worth testing is not the switch. It is the two things around it that decide whether
 * pressing it is safe: the count of accounts it would catch, and the confirmation that repeats the
 * count before anything happens.
 */
describe('SignInTab', () => {
  it('says how many accounts the requirement would catch', async () => {
    render(<SignInTab />);

    expect(await screen.findByText(/2 accounts have not paired/)).toBeInTheDocument();
  });

  it('asks before turning it on, and says the number again', async () => {
    const user = userEvent.setup();
    render(<SignInTab />);

    await user.click(await screen.findByRole('switch', { name: /Require a second factor/ }));

    // The dialog repeats the count rather than asking "are you sure": what makes this decision
    // safe is knowing how many people it reaches, and that is the sentence to read twice.
    expect(await screen.findByText(/2 accounts have no authenticator paired/)).toBeInTheDocument();
  });

  it('turns it off without asking, because nothing is lost by that', async () => {
    const user = userEvent.setup();
    server.use(
      graphqlWith({
        SignInPolicy: () => ({
          signInPolicy: { ...signInPolicyFixture, secondFactorRequired: true },
        }),
      }),
    );
    render(<SignInTab />);

    const control = await screen.findByRole('switch', { name: /Require a second factor/ });
    await waitFor(() => expect(control).toBeChecked());
    await user.click(control);

    expect(screen.queryByText(/have no authenticator paired/)).not.toBeInTheDocument();
  });

  /**
   * The refusal the server makes when the caller has no factor of their own, shown with the one
   * thing that fixes it.
   */
  it('shows the way out when the server refuses because the caller has no factor', async () => {
    const user = userEvent.setup();
    server.use(
      graphqlWith({
        RequireSecondFactor: () => {
          throw new Error('Requiring a second factor would lock you out.');
        },
      }),
    );
    render(<SignInTab />);

    await user.click(await screen.findByRole('switch', { name: /Require a second factor/ }));
    await user.click(await screen.findByRole('button', { name: 'Require it' }));

    expect(await screen.findByText(/would lock you out/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Pair an authenticator with your own account/ }),
    ).toBeInTheDocument();
  });
});
