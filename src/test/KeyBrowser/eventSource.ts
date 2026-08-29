import { currentMockKeys } from '@mocks/handlers';

/**
 * Stand-in for the browser's EventSource.
 *
 * <p>jsdom has none, and MSW cannot hold a streaming response open, so the fake replays frames the
 * test controls. It closes with an error event, which is exactly how a real EventSource reports
 * the end of a finite stream — the behaviour the hook depends on.
 */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  /**
   * Delivers one key, as the server would.
   *
   * <p>Silent once closed, because a real EventSource stops dispatching then — a fake that keeps
   * delivering would hide an off-by-one in whatever consumes it.
   */
  emit(entry: unknown): void {
    if (this.closed) {
      return;
    }
    this.onmessage?.({ data: JSON.stringify(entry) } as MessageEvent<string>);
  }

  /** Ends the stream the way a completed scan does. */
  finish(): void {
    this.onerror?.();
  }

  /** Replays the fixtures that match the URL's filters, then ends. */
  replayMatching(): void {
    const params = new URL(this.url, 'http://localhost').searchParams;
    const match = params.get('match');
    const type = params.get('type');
    const pattern = match
      ? new RegExp(
          `^${match
            .split('*')
            .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')}$`,
        )
      : null;

    currentMockKeys()
      .filter((entry) => !pattern || pattern.test(entry.key))
      .filter((entry) => !type || entry.type === type)
      .forEach((entry) => this.emit(entry));
    this.finish();
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }

  static latest(): FakeEventSource {
    const last = FakeEventSource.instances.at(-1);
    if (!last) {
      throw new Error('No EventSource was opened');
    }
    return last;
  }

  /** Installs the fake globally for a test file. */
  static install(): void {
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  }
}
