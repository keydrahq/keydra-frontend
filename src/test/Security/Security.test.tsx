import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AclUsers } from '@app/Security/AclUsers';
import { Audit } from '@app/Security/Audit';
import { IdentityIndicator } from '@app/Security/IdentityIndicator';
import { SecurityBanner } from '@app/Security/SecurityBanner';
import { RequiresSignIn } from '@app/Security/RequiresSignIn';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { graphqlWith } from '@mocks/handlers';
import { server } from '@mocks/node';
import { render } from '@test/utils';

/**
 * Replaces the identity the mock server reports.
 *
 * <p>Two endpoints, because they answer two questions: who Keydra thinks you are, and whether
 * there is anything to sign into at all. A test that changed only the first would be describing
 * an instance that cannot exist.
 */
const identity = (name: string, roles: string[], securityEnabled: boolean, authenticated = true) =>
  server.use(
    graphqlWith({
      Me: () => ({
        me: { name, roles, securityEnabled },
        effectivePermissions: {
          username: name,
          securityEnabled,
          instance: [],
          targets: [],
        },
      }),
      AuthState: () => ({
        authState: { securityEnabled, needsSetup: false, authenticated, username: name },
      }),
    }),
  );

describe('IdentityIndicator', () => {
  it('says plainly when nothing is being enforced', async () => {
    render(<SecurityBanner />);

    // An open instance that looks secured is how one ends up exposed by somebody who
    // believed it was not. Said in the page's banner rather than in the masthead, where
    // as a filled warning label it was the loudest thing on every screen.
    expect(await screen.findByText(/Security off/)).toBeInTheDocument();
  });

  it('keeps the masthead quiet while nothing is enforced', async () => {
    render(<IdentityIndicator />);

    // The banner has already said it; the corner where a user's identity goes should not
    // repeat it.
    await waitFor(() => expect(screen.queryByText(/Security off/)).not.toBeInTheDocument());
  });

  it('names the user and, when asked, what they hold', async () => {
    identity('ada', ['admin'], true);
    render(<IdentityIndicator />);

    // The name is on the masthead; the roles and the way out are one click in, because a
    // masthead is not the place for a list that grows.
    const account = await screen.findByRole('button', { name: /ada/ });
    await userEvent.click(account);

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('Security off')).not.toBeInTheDocument();
  });
});

describe('Audit', () => {
  /** The action names appear in the filter as well as the table, so queries are scoped. */
  const auditTable = async () => {
    await screen.findByText('ada');
    return within(screen.getByRole('grid', { name: 'Audit log' }));
  };

  it('lists what was done and by whom, in words', async () => {
    render(<Audit />);

    const table = await auditTable();
    // The row says what happened, not which identifier the backend files it under: an
    // audit log nobody can read at a glance is an audit log nobody reads.
    expect(table.getByText('Key deleted')).toBeInTheDocument();
    expect(table.queryByText('key.delete')).not.toBeInTheDocument();
    expect(table.getByText('ada')).toBeInTheDocument();
  });

  it('marks a refused attempt as refused', async () => {
    render(<Audit />);

    const table = await auditTable();
    const row = table.getByText('Value changed').closest<HTMLElement>('tr')!;
    expect(within(row).getByText('refused')).toBeInTheDocument();
  });

  it('narrows by who did it', async () => {
    const user = userEvent.setup();
    let requested: string | null = null;
    server.use(
      graphqlWith({
        AuditPage: (variables) => {
          requested = (variables.actor as string | null) ?? null;
          return { auditLog: [] };
        },
      }),
    );
    render(<Audit />);

    await user.type(screen.getByLabelText('Who'), 'ada');

    // The server does the filtering; the page never holds the whole log to filter it.
    await waitFor(() => expect(requested).toBe('ada'));
  });

  it('says so when nothing has been recorded', async () => {
    server.use(graphqlWith({ AuditPage: () => ({ auditLog: [] }) }));
    render(<Audit />);

    expect(await screen.findByText('Nothing recorded yet')).toBeInTheDocument();
  });
});

describe('AclUsers', () => {
  const openAcl = () =>
    render(
      <NotificationProvider>
        <AclUsers />
      </NotificationProvider>,
      { route: '/connections/1/acl', path: '/connections/:connectionId/acl' },
    );

  it('lists the users the target knows about', async () => {
    openAcl();

    expect(await screen.findByText('default')).toBeInTheDocument();
    expect(screen.getByText('reader')).toBeInTheDocument();
  });

  it('says whether a password is set without showing anything of it', async () => {
    openAcl();

    const row = (await screen.findByText('reader')).closest<HTMLElement>('tr')!;
    expect(within(row).getByText('set')).toBeInTheDocument();
    // The rule string carries "#hash"; nothing of it reaches the table.
    expect(document.body.textContent).not.toContain('#hash');
  });

  it('will not offer to remove the default user', async () => {
    openAcl();

    const row = (await screen.findByText('default')).closest<HTMLElement>('tr')!;
    expect(within(row).getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('sends the rules as typed, split into arguments', async () => {
    const user = userEvent.setup();
    let sent: unknown = null;
    server.use(
      graphqlWith({
        SetAclUser: (variables) => {
          sent = variables.user ?? variables;
          return { setAclUser: true };
        },
      }),
    );
    openAcl();
    await screen.findByText('default');

    await user.click(screen.getByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText(/Username/), 'analyst');
    const rules = screen.getByLabelText(/Rules/);
    await user.clear(rules);
    await user.type(rules, 'on ~metrics:* +@read');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(sent).toEqual({
        username: 'analyst',
        rules: ['on', '~metrics:*', '+@read'],
      }),
    );
  });
});

describe('RequiresSignIn', () => {
  it('lets a development instance through without a sign-in', async () => {
    render(
      <RequiresSignIn>
        <span>the application</span>
      </RequiresSignIn>,
    );

    // Nothing is enforced here, so there is nobody to sign in as; a wall in front of an
    // open instance would make it look like the secured one.
    expect(await screen.findByText('the application')).toBeInTheDocument();
  });

  it('asks for a sign-in when access is enforced and nobody is signed in', async () => {
    identity('anonymous', [], true, false);
    render(
      <RequiresSignIn>
        <span>the application</span>
      </RequiresSignIn>,
    );

    expect(await screen.findByText('Sign in to Keydra')).toBeInTheDocument();
    expect(screen.queryByText('the application')).not.toBeInTheDocument();
  });

  it('offers to make the first administrator on an instance with no accounts', async () => {
    server.use(
      graphqlWith({
        AuthState: () => ({
          authState: {
            securityEnabled: true,
            needsSetup: true,
            authenticated: false,
            username: 'anonymous',
          },
        }),
      }),
    );
    render(
      <RequiresSignIn>
        <span>the application</span>
      </RequiresSignIn>,
    );

    // A login form on an instance with nobody to log in as is a wall with no key.
    expect(await screen.findByText('Set up Keydra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create the administrator' })).toBeInTheDocument();
  });

  it('lets a signed-in user through', async () => {
    identity('ada', ['admin'], true);
    render(
      <RequiresSignIn>
        <span>the application</span>
      </RequiresSignIn>,
    );

    expect(await screen.findByText('the application')).toBeInTheDocument();
  });
});
