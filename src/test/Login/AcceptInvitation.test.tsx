import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AcceptInvitation } from '@app/Login/AcceptInvitation';
import { server } from '@mocks/node';
import { render } from '@test/utils';

const mount = (token: string) =>
  render(<AcceptInvitation />, {
    route: `/invitation/${token}`,
    path: '/invitation/:token',
  });

/**
 * The page a link leads to.
 *
 * <p>What matters here is what it does before offering a form. Somebody who followed a mail from
 * last month should be told the link has expired, not asked to think of a password and refused
 * afterwards — and the three refusals send them to three different places.
 */
describe('AcceptInvitation', () => {
  it('asks for a password when the link is still good', async () => {
    mount('a-token');

    // The heading is part of the frame and is there while the link is still being checked,
    // so what says the form arrived is the field.
    expect(await screen.findByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a password/)).toBeInTheDocument();
  });

  it('says a spent link has been used rather than offering a form', async () => {
    mount('spent');

    expect(await screen.findByText(/already been used/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument();
  });

  it('says an expired link has expired', async () => {
    server.use(
      http.get('/api/v1/invitations/:token', () =>
        HttpResponse.json({
          usable: false,
          refusal: 'EXPIRED',
          username: null,
          displayName: null,
          purpose: null,
        }),
      ),
    );
    mount('old');

    expect(await screen.findByText(/has expired/)).toBeInTheDocument();
  });

  it('will not submit two passwords that differ', async () => {
    const user = userEvent.setup();
    mount('a-token');

    await user.type(await screen.findByLabelText(/^Password/), 'a-long-enough-password');
    await user.type(screen.getByLabelText(/^Repeat the password/), 'a-different-password');

    expect(screen.getByText(/not the same/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set the password' })).toBeDisabled();
  });

  /**
   * The letter and the page it opens agree.
   *
   * <p>`?lang=` rather than the `?lng=` the language detector already claims: that one is cached,
   * so following a link would change what language the whole application speaks from then on.
   */
  it('is written in the language the letter that carried the link was written in', async () => {
    render(<AcceptInvitation />, {
      route: '/invitation/a-token?lang=tr',
      path: '/invitation/:token',
    });

    // Not the field labels: "Parola" and "Parolayı tekrarlayın" both begin the same way, and
    // what this is asserting is the language rather than the form.
    expect(await screen.findByRole('button', { name: 'Parolayı belirle' })).toBeInTheDocument();
    expect(screen.getByText('Bir parola belirleyin')).toBeInTheDocument();
  });

  it('ignores a language nobody wrote a letter in', async () => {
    render(<AcceptInvitation />, {
      route: '/invitation/a-token?lang=kw',
      path: '/invitation/:token',
    });

    expect(await screen.findByLabelText(/^Password/)).toBeInTheDocument();
  });

  it('sends somebody to sign in once the password is set', async () => {
    const user = userEvent.setup();
    mount('a-token');

    await user.type(await screen.findByLabelText(/^Password/), 'a-long-enough-password');
    await user.type(screen.getByLabelText(/^Repeat the password/), 'a-long-enough-password');
    await user.click(screen.getByRole('button', { name: 'Set the password' }));

    await waitFor(() => expect(screen.getByText(/password is set/)).toBeInTheDocument());
  });
});
