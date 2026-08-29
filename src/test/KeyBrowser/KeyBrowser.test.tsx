import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/** Opens the browser for connection 1 and lets the seeded scan finish. */
const openBrowser = async () => {
  render(<KeyBrowser />, { route: '/connections/1/keys', path: '/connections/:connectionId/keys' });
  await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
  act(() => FakeEventSource.latest().replayMatching());
  await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());
};

describe('KeyBrowser', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
  });

  it('lists streamed keys with their type and TTL', async () => {
    await openBrowser();

    const row = screen.getByText('session:abc').closest<HTMLElement>('[role="row"]')!;
    expect(within(row).getByText('string')).toBeInTheDocument();
    // 30 seconds is rendered as a countdown, not a raw number of seconds.
    expect(within(row).getByText('30s')).toBeInTheDocument();

    // A key with no expiry shows a dash rather than a misleading -1.
    const noExpiry = screen.getByText('user:1:profile').closest<HTMLElement>('[role="row"]')!;
    expect(within(noExpiry).getByLabelText('No expiry')).toBeInTheDocument();
  });

  it('sends the search box to the server as a glob', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await user.type(screen.getByLabelText('Search keys'), 'user:*');

    await waitFor(() => expect(FakeEventSource.latest().url).toContain('match=user%3A*'));
    act(() => FakeEventSource.latest().replayMatching());

    await waitFor(() => expect(screen.queryByText('session:abc')).not.toBeInTheDocument());
    expect(screen.getByText('user:1:profile')).toBeInTheDocument();
  });

  it('filters by value type server-side', async () => {
    const user = userEvent.setup();
    await openBrowser();

    // A PatternFly filter menu, not a native select: open it and pick.
    await user.click(screen.getByRole('button', { name: /All types/ }));
    await user.click(await screen.findByRole('option', { name: 'hash' }));

    await waitFor(() => expect(FakeEventSource.latest().url).toContain('type=hash'));
    act(() => FakeEventSource.latest().replayMatching());

    await waitFor(() => expect(screen.queryByText('session:abc')).not.toBeInTheDocument());

    // The narrowed list explains itself through the control that narrowed it: the menu
    // toggle now reads "hash". It used to say so twice — once here and once as a label in
    // a row of its own, which pushed the list being filtered down the page.
    expect(screen.getByRole('button', { name: /hash/ })).toBeInTheDocument();
  });

  it('clears every filter at once', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await user.click(screen.getByRole('button', { name: /All types/ }));
    await user.click(await screen.findByRole('option', { name: 'hash' }));
    await screen.findByRole('button', { name: 'Clear all filters' });

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => expect(FakeEventSource.latest().url).not.toContain('type=hash'));
  });

  it('asks before deleting and reports the count', async () => {
    const user = userEvent.setup();
    await openBrowser();

    const row = screen.getByText('session:abc').closest<HTMLElement>('[role="row"]')!;
    await user.click(within(row).getByRole('button', { name: 'Actions for session:abc' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    expect(screen.getByText(/"session:abc" will be deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // The scan restarts after a mutation, since the old results are stale.
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(1));
    act(() => FakeEventSource.latest().replayMatching());
  });

  it('deletes a multi-key selection in one go', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await user.click(screen.getByLabelText('Select user:1:profile'));
    await user.click(screen.getByLabelText('Select user:2:profile'));

    // The count lives on the button itself, so the action says what it will act on.
    await user.click(screen.getByRole('button', { name: 'Delete 2' }));

    expect(screen.getByText(/2 keys will be deleted/)).toBeInTheDocument();
  });

  it('keeps the rename form open when the destination already exists', async () => {
    const user = userEvent.setup();
    await openBrowser();

    const row = screen.getByText('user:1:profile').closest<HTMLElement>('[role="row"]')!;
    await user.click(within(row).getByRole('button', { name: 'Actions for user:1:profile' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

    const target = screen.getByLabelText(/New name/);
    await user.clear(target);
    await user.type(target, 'user:2:profile');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    // RENAMENX refuses rather than destroying the existing key, and the form says so.
    expect(await screen.findByText(/Tick overwrite to replace it/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sets a TTL on a key that had none', async () => {
    const user = userEvent.setup();
    await openBrowser();

    const row = screen.getByText('user:1:profile').closest<HTMLElement>('[role="row"]')!;
    await user.click(within(row).getByRole('button', { name: 'Actions for user:1:profile' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set TTL' }));

    const seconds = screen.getByLabelText('Seconds until expiry');
    await user.clear(seconds);
    await user.type(seconds, '120');
    await user.click(screen.getByRole('button', { name: 'Set TTL' }));

    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(1));
  });

  it('says the target is empty when nothing is filtering the list', async () => {
    render(<KeyBrowser />, {
      route: '/connections/1/keys',
      path: '/connections/:connectionId/keys',
    });
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));

    act(() => FakeEventSource.latest().finish());

    // Nothing was narrowing the list, so this is a target waiting to be filled — not a
    // filter that found nothing, and the way out is to write a key.
    const empty = (await screen.findByText('This target has no keys')).closest<HTMLElement>(
      '.pf-v6-c-empty-state',
    )!;
    // The way out is offered where the eye already is; the toolbar has one too.
    expect(within(empty).getByRole('button', { name: 'New key' })).toBeInTheDocument();
  });

  it('says nothing matches when a filter is what emptied the list', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await user.type(screen.getByLabelText('Search keys'), 'nothing-like-this');
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(1));
    act(() => FakeEventSource.latest().finish());

    const empty = (await screen.findByText('No keys match')).closest<HTMLElement>(
      '.pf-v6-c-empty-state',
    )!;
    expect(within(empty).getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('duplicates a key under a new name, leaving the original', async () => {
    const user = userEvent.setup();
    await openBrowser();

    const row = screen.getByText('user:1:profile').closest<HTMLElement>('[role="row"]')!;
    await user.click(within(row).getByRole('button', { name: 'Actions for user:1:profile' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));

    const target = screen.getByLabelText(/New name/);
    await user.clear(target);
    await user.type(target, 'user:1:backup');
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    // The scan reruns after the copy, and both names are in it.
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(1));
    act(() => FakeEventSource.latest().replayMatching());
    await waitFor(() => expect(screen.getByText('user:1:backup')).toBeInTheDocument());
    expect(screen.getByText('user:1:profile')).toBeInTheDocument();
  });
});
