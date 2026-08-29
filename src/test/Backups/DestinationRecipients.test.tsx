import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DestinationDialog } from '@app/Backups/DestinationDialog';
import { render } from '@test/utils';

/**
 * The list of keys a destination's backups can be opened with.
 *
 * <p>One recipient meant the person holding that private half was the only person who could read a
 * year of backups. What is worth pinning here is the list: that it can hold more than one, that a
 * generated key joins it rather than replacing what is there, and that the sentence answering "why
 * can the key I just added not read last night's backup" is on the page before anybody asks it.
 */
describe('DestinationDialog recipients', () => {
  const openTheSealingStep = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<DestinationDialog onClose={() => undefined} />);
    await user.type(await screen.findByLabelText(/^Name/), 'nightly');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('radio', { name: /a key/i }));
  };

  it('holds more than one key, each with a name', async () => {
    const user = userEvent.setup();
    await openTheSealingStep(user);

    await user.click(screen.getByRole('button', { name: 'Add a key' }));
    await user.click(screen.getByRole('button', { name: 'Add a key' }));

    expect(screen.getByText('Key 1')).toBeInTheDocument();
    expect(screen.getByText('Key 2')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Name')).toHaveLength(2);
  });

  it('adds a generated key to the list rather than replacing it', async () => {
    const user = userEvent.setup();
    await openTheSealingStep(user);

    await user.click(screen.getByRole('button', { name: 'Add a key' }));
    await user.type(screen.getByLabelText('Public key'), 'keydra-pk1:already-had-this');
    await user.click(screen.getByRole('button', { name: 'Generate a key pair' }));

    const keys = await screen.findAllByLabelText('Public key');
    expect(keys).toHaveLength(2);
    expect(keys[0]).toHaveValue('keydra-pk1:already-had-this');
    // Shown once and held nowhere else, which is the whole claim of this mode. In a
    // ClipboardCopy, so it is a value to copy rather than text to read.
    expect(
      screen.getByDisplayValue('keydra-sk1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'),
    ).toBeInTheDocument();
  });

  it('takes one away without touching the others', async () => {
    const user = userEvent.setup();
    await openTheSealingStep(user);

    await user.click(screen.getByRole('button', { name: 'Add a key' }));
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Add a key' }));
    await user.click(screen.getByRole('button', { name: /^Remove Ada/ }));

    expect(screen.getAllByLabelText('Name')).toHaveLength(1);
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  /** The question this design produces, answered before it is asked. */
  it('says a key added later opens later backups', async () => {
    const user = userEvent.setup();
    await openTheSealingStep(user);

    expect(
      within(screen.getByRole('dialog')).getByText(/A key added later opens later backups/),
    ).toBeInTheDocument();
  });
});
