import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProvidersTab } from '@app/Access/ProvidersTab';
import { SignIn } from '@app/Login/SignIn';
import { RequiresSignIn } from '@app/Security/RequiresSignIn';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

describe('ProvidersTab', () => {
  it('lists a provider with the redirect URI its own configuration has to match', async () => {
    render(<ProvidersTab />);

    expect(await screen.findByText('Company Keycloak')).toBeInTheDocument();
    // The one value that has to be given to the provider exactly, and the usual reason a
    // first attempt is refused — so it is on the row rather than two clicks away.
    expect(
      screen.getByDisplayValue('http://localhost:9000/api/v1/auth/providers/keycloak/callback'),
    ).toBeInTheDocument();
  });

  it('says whether Keydra knows where to send people', async () => {
    render(<ProvidersTab />);

    const row = within(await screen.findByRole('row', { name: /Company Keycloak/ }));
    expect(row.getByText('Endpoints known')).toBeInTheDocument();
  });

  it('shows the group mapping rather than leaving it to be guessed', async () => {
    render(<ProvidersTab />);

    expect(await screen.findByText('platform-team → platform')).toBeInTheDocument();
  });

  it('says a secret is stored without ever showing one', async () => {
    server.use(
      graphqlWith({
        IdentityProviders: () => ({
          identityProviders: [
            {
              id: 1,
              key: 'keycloak',
              displayName: 'Company Keycloak',
              kind: 'OIDC',
              enabled: true,
              sortOrder: 0,
              issuer: 'https://sso.example/realms/company',
              clientId: 'keydra',
              hasClientSecret: false,
              scopes: 'openid profile email',
              authorizationEndpoint: null,
              tokenEndpoint: null,
              userInfoEndpoint: null,
              endpointsDiscovered: false,
              subjectClaim: 'sub',
              usernameClaim: 'preferred_username',
              emailClaim: 'email',
              nameClaim: 'name',
              groupsClaim: null,
              autoCreateUsers: true,
              redirectUri: 'http://localhost:9000/api/v1/auth/providers/keycloak/callback',
              groupMappings: [],
            },
          ],
        }),
      }),
    );
    render(<ProvidersTab />);

    // A provider with nothing to sign in through says so, rather than appearing on the
    // login page as a button that leads nowhere.
    expect(await screen.findByText('No endpoints')).toBeInTheDocument();
    expect(screen.getByText('No secret')).toBeInTheDocument();
  });
});

describe('SignIn', () => {
  const offering = (...providers: { key: string; displayName: string }[]) =>
    server.use(
      graphqlWith({
        SignInOptions: () => ({
          signInOptions: providers.map((provider) => ({ ...provider, kind: 'OIDC' })),
        }),
      }),
    );

  it('offers a way in for every configured provider', async () => {
    offering({ key: 'keycloak', displayName: 'Company Keycloak' });
    render(<SignIn needsSetup={false} />);

    const label = await screen.findByText('Continue with Company Keycloak');
    // A navigation rather than a request: the flow ends at somebody else's site, so it has
    // to be a link the browser follows rather than a fetch.
    expect(label.closest('a')).toHaveAttribute('href', '/api/v1/auth/providers/keycloak/start');
  });

  it('still asks for a password, because a provider is a second way in and not a replacement', async () => {
    offering({ key: 'keycloak', displayName: 'Company Keycloak' });
    render(<SignIn needsSetup={false} />);

    expect(await screen.findByLabelText(/Username/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
  });

  it('offers nothing but the first administrator on an instance with no accounts', async () => {
    offering({ key: 'keycloak', displayName: 'Company Keycloak' });
    render(<SignIn needsSetup />);

    expect(await screen.findByText('Set up Keydra')).toBeInTheDocument();
    // Signing in through a provider that could not grant anybody anything yet would be a
    // way in to an instance with nobody able to configure it.
    expect(screen.queryByRole('link', { name: /Continue with/ })).not.toBeInTheDocument();
  });

  it('shows the login page rather than the application when it cannot tell', async () => {
    // The failure this is here for: showing the shell to somebody who is not signed in is not
    // the permissive choice, it is the broken one — every request answers 401, every page is
    // an error, and there is no way from there back to a form.
    // Refused rather than answered: "nobody is signed in" and "this could not be asked" are
    // different things, and only one of them means showing the login page.
    server.use(graphqlWith({ AuthState: null }));
    render(
      <RequiresSignIn>
        <span>the application</span>
      </RequiresSignIn>,
    );

    // Longer than the default wait: the state query retries once before giving up, which is
    // deliberate — a single dropped request while a backend restarts should not send somebody
    // who is signed in back to the form.
    //
    // The login page's own frame rather than the form: a server that cannot be asked cannot
    // take a password either, so offering one would be offering something that cannot work.
    // What matters here is the half that is not about wording — the application is not shown.
    expect(
      await screen.findByText('Keydra could not be reached', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('the application')).not.toBeInTheDocument();
  });

  it('says what went wrong when somebody comes back refused', async () => {
    window.history.replaceState({}, '', '/?signInError=Keydra%20has%20no%20account%20for%20you.');
    try {
      render(<SignIn needsSetup={false} />);
      expect(await screen.findByText('Keydra has no account for you.')).toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('refuses a wrong password with one message for both halves of it', async () => {
    server.use(http.post('/api/v1/auth/login', () => new HttpResponse(null, { status: 401 })));
    render(<SignIn needsSetup={false} />);

    await userEvent.type(await screen.findByLabelText(/Username/), 'ada');
    await userEvent.type(screen.getByLabelText(/Password/), 'not-the-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // Telling them apart tells somebody guessing which half they already have right.
    expect(await screen.findByText('Wrong username or password.')).toBeInTheDocument();
  });
});
