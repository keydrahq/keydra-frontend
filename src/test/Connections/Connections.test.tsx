import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Connections } from '@app/Connections/Connections';
import { connectionFixtures } from '@mocks/handlers';
import { render } from '@test/utils';

/**
 * The card for one profile.
 *
 * <p>Found through the card's id rather than by walking up from the name: the list is a gallery of
 * cards, and `closest('article')` would tie every assertion to the element PatternFly happens to
 * render a card as.
 */
const cardFor = (name: string): HTMLElement => {
  const card = screen.getByText(name).closest('.pf-v6-c-card');
  if (!card) {
    throw new Error(`No card for ${name}`);
  }
  return card as HTMLElement;
};

/** Opens one card's menu, which is named after the profile so each card's is distinct. */
const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> => {
  await user.click(within(cardFor(name)).getByRole('button', { name: `Actions for ${name}` }));
};

describe('Connections', () => {
  it('lists saved profiles with their status and detected server', async () => {
    render(<Connections />);

    await waitFor(() => {
      expect(screen.getByText('local-redis')).toBeInTheDocument();
    });

    const redis = cardFor('local-redis');
    expect(within(redis).getByText('Up')).toBeInTheDocument();
    expect(within(redis).getByText('Redis 8.10.0')).toBeInTheDocument();

    const valkey = cardFor('local-valkey');
    expect(within(valkey).getByText('Down')).toBeInTheDocument();
    // A target that has never answered has nothing to report about its flavor
    expect(within(valkey).getByText('Not detected yet')).toBeInTheDocument();
  });

  it('creates a profile through the form', async () => {
    const user = userEvent.setup();
    render(<Connections />);
    await waitFor(() => expect(screen.getByText('local-redis')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    await user.type(screen.getByLabelText(/Name/), 'new-target');
    await user.clear(screen.getByLabelText(/Port/));
    await user.type(screen.getByLabelText(/Port/), '6390');
    // The form is a wizard: everything after the server is optional, so saving means
    // walking to the last step, which is one click on its name.
    await user.click(screen.getByRole('button', { name: 'Access' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('new-target')).toBeInTheDocument();
    });
    expect(screen.getByText('redis://localhost:6390')).toBeInTheDocument();
  });

  it('surfaces a duplicate name as an error instead of closing the form', async () => {
    const user = userEvent.setup();
    render(<Connections />);
    await waitFor(() => expect(screen.getByText('local-redis')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    await user.type(screen.getByLabelText(/Name/), 'local-redis');
    await user.click(screen.getByRole('button', { name: 'Access' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // Still open, still holding what was typed — which is on the first step, where the
    // refusal is about a field.
    await user.click(screen.getByRole('button', { name: 'Server' }));
    expect(screen.getByLabelText(/Name/)).toHaveValue('local-redis');
  });

  it('does not prefill the password when editing, and says one is stored', async () => {
    const user = userEvent.setup();
    render(<Connections />);
    await waitFor(() => expect(screen.getByText('local-valkey')).toBeInTheDocument());

    await openMenu(user, 'local-valkey');
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    // The credentials are the wizard's second step.
    await user.click(screen.getByRole('button', { name: 'Authentication' }));

    expect(screen.getByLabelText(/Password/)).toHaveValue('');
    expect(screen.getByText(/A password is stored/)).toBeInTheDocument();
  });

  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    render(<Connections />);
    await waitFor(() => expect(screen.getByText('local-redis')).toBeInTheDocument());

    await openMenu(user, 'local-redis');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    expect(screen.getByText(/will be removed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('local-redis')).not.toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no profiles', async () => {
    const { unmount } = render(<Connections />);
    await waitFor(() => expect(screen.getByText('local-redis')).toBeInTheDocument());
    unmount();

    // delete both fixtures through the API the page uses
    const user = userEvent.setup();
    render(<Connections />);
    await waitFor(() => expect(screen.getByText('local-redis')).toBeInTheDocument());
    for (const name of connectionFixtures.map((c) => c.name)) {
      await openMenu(user, name);
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByText(name)).not.toBeInTheDocument());
    }

    expect(await screen.findByText('No connections yet')).toBeInTheDocument();
  });
});
