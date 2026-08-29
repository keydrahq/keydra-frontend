import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionsCard } from '@app/Settings/SessionsCard';
import { graphqlWith, sessionFixtures } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

/**
 * The browsers you are signed in on.
 *
 * <p>The card's job is to make one row distinguishable from another and to make ending the wrong
 * one hard. So what is tested is what somebody reads before pressing something they cannot undo:
 * which browser each row is, which one they are on, and what the confirmation says.
 */
describe('SessionsCard', () => {
  it('names each browser rather than showing the whole user agent', async () => {
    render(<SessionsCard />);

    // A user agent is a paragraph of history — every browser claims to be several others —
    // and what somebody needs from it is "my laptop" or "not mine".
    expect(await screen.findByText(/Chrome · Linux/)).toBeInTheDocument();
    expect(screen.getByText(/Safari · Mac/)).toBeInTheDocument();
    expect(screen.queryByText(/AppleWebKit/)).not.toBeInTheDocument();
  });

  it('marks the browser reading the page', async () => {
    render(<SessionsCard />);

    expect(await screen.findByText('This browser')).toBeInTheDocument();
  });

  it('offers to sign out of this browser and to end the other one', async () => {
    render(<SessionsCard />);

    // The wording differs on purpose: ending your own session is signing out, and one button
    // saying "End" for both would invite doing it by accident.
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End' })).toBeInTheDocument();
  });

  it('says what will happen before ending another session', async () => {
    const user = userEvent.setup();
    render(<SessionsCard />);

    await user.click(await screen.findByRole('button', { name: 'End' }));

    expect(await screen.findByText(/End this session\?/)).toBeInTheDocument();
    expect(screen.getByText(/signed out on its next request/)).toBeInTheDocument();
  });

  it('warns that ending your own session signs you out', async () => {
    const user = userEvent.setup();
    render(<SessionsCard />);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText(/browser you are reading on/)).toBeInTheDocument();
  });

  it('offers to end every other session at once', async () => {
    const user = userEvent.setup();
    render(<SessionsCard />);

    await user.click(await screen.findByRole('button', { name: /End the other session/ }));

    expect(await screen.findByText(/Every browser except this one/)).toBeInTheDocument();
  });

  /**
   * One page, not every session there has ever been.
   *
   * <p>A device that signs in each morning and never signs out leaves one behind a day, and the
   * page whose purpose is spotting the row that is not yours becomes a page you scroll.
   */
  it('asks for one page rather than for all of them', async () => {
    const asked: unknown[] = [];
    server.use(
      graphqlWith({
        MySessions: (variables) => {
          asked.push(variables);
          return { mySessions: sessionFixtures, mySessionCount: sessionFixtures.length };
        },
      }),
    );
    render(<SessionsCard />);

    await waitFor(() => {
      expect(asked).toEqual([{ first: 10, offset: 0 }]);
    });
  });

  /**
   * And the button counts what it will end, not what is on screen.
   *
   * <p>The difference paging makes: counting the rows in front of somebody would have this say
   * "end 9 others" on a full page and "end 2" on the last one, for the same click.
   */
  it('counts the sessions it is not showing', async () => {
    server.use(
      graphqlWith({
        MySessions: () => ({ mySessions: [sessionFixtures[0]], mySessionCount: 12 }),
      }),
    );
    render(<SessionsCard />);

    expect(
      await screen.findByRole('button', { name: 'End the other 11 sessions' }),
    ).toBeInTheDocument();
  });

  it('asks for the next page when somebody turns to it', async () => {
    const asked: unknown[] = [];
    server.use(
      graphqlWith({
        MySessions: (variables) => {
          asked.push(variables);
          return { mySessions: sessionFixtures, mySessionCount: 30 };
        },
      }),
    );
    const user = userEvent.setup();
    render(<SessionsCard />);

    await user.click(await screen.findByRole('button', { name: 'Go to next page' }));

    await waitFor(() => {
      expect(asked).toContainEqual({ first: 10, offset: 10 });
    });
  });

  it('says so when the sessions cannot be read', async () => {
    // A refusal rather than an empty list: "nowhere else is signed in" and "this could not be
    // read" are different things to be told, and only one of them is worth a warning.
    server.use(graphqlWith({ MySessions: null }));
    render(<SessionsCard />);

    await waitFor(() =>
      expect(screen.getByText('Your sessions could not be read')).toBeInTheDocument(),
    );
  });
});
