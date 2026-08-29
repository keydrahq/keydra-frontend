import type { NotificationMessage } from './api.types';

export type NotificationListener<T = unknown> = (message: NotificationMessage<T>) => void;

/** Injectable socket factory, so tests can drive the client without a real server. */
export type SocketFactory = (url: string) => WebSocket;

/** Injectable timer, so tests can advance reconnect backoff without waiting. */
export type ScheduleFn = (callback: () => void, delayMs: number) => number;

export const NotificationConnectionState = {
  Closed: 'closed',
  Connecting: 'connecting',
  Open: 'open',
} as const;

export type NotificationConnectionState =
  (typeof NotificationConnectionState)[keyof typeof NotificationConnectionState];

export type ConnectionStateListener = (state: NotificationConnectionState) => void;

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 15_000;

/**
 * Single WebSocket client for the whole app.
 *
 * The backend broadcasts `{ category, payload, ts }` envelopes and components subscribe by
 * category. The socket reconnects on its own with exponential backoff: without that, a backend
 * restart or a brief network drop would leave the UI silently stale — showing data it believes is
 * live while nothing is arriving any more.
 */
export class NotificationService {
  private readonly path: string;
  private readonly socketFactory: SocketFactory;
  private readonly schedule: ScheduleFn;
  private readonly listeners = new Map<string, Set<NotificationListener>>();
  private readonly stateListeners = new Set<ConnectionStateListener>();

  private socket: WebSocket | null = null;
  private state: NotificationConnectionState = NotificationConnectionState.Closed;
  private retryDelay = INITIAL_RETRY_MS;
  private retryTimer: number | null = null;
  /** Set while a deliberate disconnect is in progress, to suppress the reconnect. */
  private closing = false;

  constructor(
    path = '/api/v1/notifications',
    socketFactory: SocketFactory = (url) => new WebSocket(url),
    schedule: ScheduleFn = (callback, delayMs) => window.setTimeout(callback, delayMs),
  ) {
    this.path = path;
    this.socketFactory = socketFactory;
    this.schedule = schedule;
  }

  connect(): void {
    if (this.socket || this.state === NotificationConnectionState.Connecting) {
      return;
    }
    this.closing = false;
    this.open();
  }

  disconnect(): void {
    this.closing = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.setState(NotificationConnectionState.Closed);
  }

  /** Subscribes to one category; returns the unsubscribe function. */
  subscribe<T>(category: string, listener: NotificationListener<T>): () => void {
    const existing = this.listeners.get(category) ?? new Set<NotificationListener>();
    existing.add(listener as NotificationListener);
    this.listeners.set(category, existing);
    return () => {
      existing.delete(listener as NotificationListener);
      if (existing.size === 0) {
        this.listeners.delete(category);
      }
    };
  }

  /** Observes the socket's own health, so the UI can say when it is not live. */
  onStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  connectionState(): NotificationConnectionState {
    return this.state;
  }

  /** Exposed for tests: dispatches one raw frame. */
  dispatch(raw: string): void {
    let message: NotificationMessage;
    try {
      message = JSON.parse(raw) as NotificationMessage;
    } catch {
      return;
    }
    this.listeners.get(message.category)?.forEach((listener) => listener(message));
  }

  private open(): void {
    this.setState(NotificationConnectionState.Connecting);
    const socket = this.socketFactory(this.resolveUrl());
    this.socket = socket;

    socket.onopen = () => {
      // Only reset the backoff once a connection actually succeeds, otherwise a
      // server that accepts and immediately drops would be retried in a tight loop.
      this.retryDelay = INITIAL_RETRY_MS;
      this.setState(NotificationConnectionState.Open);
    };
    socket.onmessage = (event: MessageEvent<string>) => this.dispatch(event.data);
    socket.onclose = () => this.handleDrop(socket);
    socket.onerror = () => socket.close();
  }

  /**
   * Reacts to a socket closing, and only to the current one.
   *
   * <p>A close arrives asynchronously, so a socket that was replaced can report its own closure
   * after its successor is already open. Acting on that would null out the live socket's reference
   * and schedule a reconnect on top of it — leaving two connections delivering every message
   * twice, which is exactly what a duplicated notification looks like. React's development
   * double-invoked effects make that ordering the normal case rather than a rare one.
   */
  private handleDrop(closed: WebSocket): void {
    if (this.socket !== closed) {
      return;
    }
    this.socket = null;
    if (this.closing) {
      return;
    }
    this.setState(NotificationConnectionState.Closed);
    this.retryTimer = this.schedule(() => {
      this.retryTimer = null;
      this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
  }

  private setState(state: NotificationConnectionState): void {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private resolveUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${this.path}`;
  }
}
