import type { SocketFactory } from '@app/Console/useConsoleSocket';
import type { ConsoleResult } from '@app/Console/types';

/**
 * Stand-in for the browser's WebSocket.
 *
 * <p>jsdom has none, and the console is a conversation rather than a request, so the test drives
 * both halves: it reads what the component sent and decides what comes back.
 */
export class FakeSocket {
  static instances: FakeSocket[] = [];

  static readonly OPEN = 1;

  readonly sent: string[] = [];
  readyState = 0;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  readonly url: string;

  constructor(url: string) {
    // Declared as a field rather than a parameter property: the project compiles with
    // erasableSyntaxOnly, which forbids the shorthand.
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  /** Marks the socket open, which is what lets the component send. */
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  /** Delivers a reply for the command at the given position. */
  reply(result: ConsoleResult): void {
    this.receive(JSON.stringify(result));
  }

  /** Delivers a raw frame, for a socket that only ever pushes. */
  receive(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  /** Whether close() has been called, which is how a watch is stopped. */
  get closed(): boolean {
    return this.readyState === 3;
  }

  /** The command lines sent so far, parsed. */
  commands(): { id: string; line: string }[] {
    return this.sent.map((raw) => JSON.parse(raw) as { id: string; line: string });
  }

  static latest(): FakeSocket {
    return FakeSocket.instances[FakeSocket.instances.length - 1];
  }

  static reset(): void {
    FakeSocket.instances = [];
  }
}

/** Factory to hand the hook under test. */
export const fakeSocketFactory: SocketFactory = (url) =>
  new FakeSocket(url) as unknown as WebSocket;
