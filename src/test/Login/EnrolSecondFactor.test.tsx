import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnrolSecondFactor } from '@app/Login/EnrolSecondFactor';
import { render } from '@test/utils';

/**
 * The wall an instance that requires a second factor puts in front of an account with none.
 *
 * <p>The step worth pinning is the third one. Confirming hands out recovery codes that are shown
 * once and cannot be shown again, so a wall that went straight into the application the moment the
 * code was accepted would be a wall that ate them.
 */
describe('EnrolSecondFactor', () => {
  it('says why the application is not there before offering to fix it', async () => {
    render(<EnrolSecondFactor />);

    expect(await screen.findByText(/nothing else you can reach/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up an authenticator' })).toBeInTheDocument();
  });

  it('offers a way out that is not the application', async () => {
    render(<EnrolSecondFactor />);

    expect(await screen.findByRole('button', { name: 'Sign out instead' })).toBeInTheDocument();
  });

  it('shows the recovery codes and waits before letting anybody through', async () => {
    const user = userEvent.setup();
    render(<EnrolSecondFactor />);

    await user.click(await screen.findByRole('button', { name: 'Set up an authenticator' }));
    await user.type(await screen.findByLabelText(/^Code from the app/), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText(/aaaa-bbbb/)).toBeInTheDocument();
    // The button is the wait: nothing has moved on until somebody says they have the codes.
    expect(screen.getByRole('button', { name: 'Continue to Keydra' })).toBeInTheDocument();
  });
});
