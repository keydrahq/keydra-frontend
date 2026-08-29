import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { exportFilename } from '@app/KeyBrowser/download';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { render } from '@test/utils';
import { FakeEventSource } from './eventSource';

/** Opens the browser and lets the seeded scan finish. */
const openBrowser = async () => {
  render(
    <NotificationProvider>
      <KeyBrowser />
    </NotificationProvider>,
    { route: '/connections/1/keys', path: '/connections/:connectionId/keys' },
  );
  await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
  act(() => FakeEventSource.latest().replayMatching());
  await waitFor(() => expect(screen.getByText('user:1:profile')).toBeInTheDocument());
};

/** Opens the toolbar's import/export menu. */
const openTransferMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Import and export' }));
};

describe('key transfer', () => {
  let saved: { name: string; blob: Blob } | undefined;

  beforeEach(() => {
    FakeEventSource.reset();
    FakeEventSource.install();
    saved = undefined;

    // jsdom implements neither object URLs nor navigation, so the save is observed at the
    // two points the browser would have used: the URL it minted and the click it received.
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      saved = { name: '', blob: blob as Blob };
      return 'blob:keydra';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      if (saved) {
        saved.name = this.download;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports everything the filter matches when nothing is ticked', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await openTransferMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Export everything matching' }));

    await waitFor(() => expect(saved).toBeDefined());
    expect(await saved!.blob.text()).toContain('user:1:profile');
    expect(saved!.name).toMatch(/keys-\d{4}-\d{2}-\d{2}/);
  });

  it('exports only the ticked keys', async () => {
    const user = userEvent.setup();
    await openBrowser();

    await user.click(screen.getByRole('checkbox', { name: 'Select user:1:profile' }));
    await openTransferMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Export 1 key' }));

    await waitFor(() => expect(saved).toBeDefined());
    const exported = JSON.parse(await saved!.blob.text()) as { key: string }[];
    expect(exported.map((entry) => entry.key)).toEqual(['user:1:profile']);
  });

  it('restores a file and says how many keys came back', async () => {
    const user = userEvent.setup();
    await openBrowser();

    // Import is its own dialog with a drop zone now, reached from the toolbar rather than
    // from a menu item that opened the system file picker.
    await user.click(screen.getByRole('button', { name: 'Import keys' }));
    await screen.findByRole('dialog');

    const file = new File(
      [JSON.stringify([{ key: 'restored:1', ttlMillis: 0, payload: 'ZHVtbXk=' }])],
      'keys.json',
      { type: 'application/json' },
    );
    // The drop zone's own input, which is how a drop or a browse both deliver the file.
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input!, file);

    // Read and checked before anything is sent, so the button says what it will import.
    await user.click(await screen.findByRole('button', { name: 'Import 1 key' }));

    expect(await screen.findByText('1 key restored')).toBeInTheDocument();
  });
});

describe('exportFilename', () => {
  it('makes a name that says which target the file came from', () => {
    expect(exportFilename('local-redis', new Date('2026-08-19T10:20:30Z'))).toBe(
      'local-redis-keys-2026-08-19-10-20-30.json',
    );
  });

  it('keeps a profile name from turning into a path', () => {
    // A profile may be called anything, including something with a slash in it.
    expect(exportFilename('prod/eu-west', new Date('2026-08-19T00:00:00Z'))).toBe(
      'prod-eu-west-keys-2026-08-19-00-00-00.json',
    );
  });
});
