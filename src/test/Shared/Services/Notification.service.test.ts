import { describe, expect, it, vi } from 'vitest';
import {
  NotificationConnectionState,
  NotificationService,
} from '@app/Shared/Services/Notification.service';

/** Minimal stand-in for a browser WebSocket, driven by the test. */
class FakeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  close(): void {
    this.closed = true;
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  emit(data: string): void {
    this.onmessage?.({ data } as MessageEvent<string>);
  }
}

/** Captures scheduled reconnects so a test can fire them without waiting. */
const controllableSchedule = () => {
  const pending: (() => void)[] = [];
  const delays: number[] = [];
  const schedule = (callback: () => void, delayMs: number) => {
    pending.push(callback);
    delays.push(delayMs);
    return pending.length;
  };
  return { schedule, delays, runNext: () => pending.shift()?.() };
};

const setup = () => {
  const sockets: FakeSocket[] = [];
  const { schedule, delays, runNext } = controllableSchedule();
  const service = new NotificationService(
    '/api/v1/notifications',
    () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    schedule,
  );
  return { service, sockets, delays, runNext };
};

describe('NotificationService', () => {
  it('delivers messages only to listeners of the matching category', () => {
    const { service, sockets } = setup();
    const connections = vi.fn();
    const keys = vi.fn();
    service.subscribe('ConnectionStatusChanged', connections);
    service.subscribe('KeysChanged', keys);
    service.connect();
    sockets[0].open();

    sockets[0].emit(
      JSON.stringify({ category: 'ConnectionStatusChanged', payload: { id: 1 }, ts: '2026-01-01' }),
    );

    expect(connections).toHaveBeenCalledOnce();
    expect(keys).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe', () => {
    const { service, sockets } = setup();
    const listener = vi.fn();
    const unsubscribe = service.subscribe('ConnectionStatusChanged', listener);
    service.connect();
    sockets[0].open();

    unsubscribe();
    sockets[0].emit(JSON.stringify({ category: 'ConnectionStatusChanged', payload: {}, ts: '' }));

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores frames that are not valid JSON envelopes', () => {
    const { service } = setup();
    const listener = vi.fn();
    service.subscribe('ConnectionStatusChanged', listener);

    expect(() => service.dispatch('not json')).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reconnects after the socket drops, so a backend restart does not go unnoticed', () => {
    const { service, sockets, runNext } = setup();
    const listener = vi.fn();
    service.subscribe('ConnectionStatusChanged', listener);
    service.connect();
    sockets[0].open();

    // The backend goes away.
    sockets[0].close();
    expect(service.connectionState()).toBe(NotificationConnectionState.Closed);

    runNext();
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(service.connectionState()).toBe(NotificationConnectionState.Open);

    // The replacement socket feeds the same subscribers.
    sockets[1].emit(JSON.stringify({ category: 'ConnectionStatusChanged', payload: {}, ts: '' }));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('backs off between attempts and resets once a connection succeeds', () => {
    const { service, sockets, delays, runNext } = setup();
    service.connect();

    sockets[0].close();
    runNext();
    sockets[1].close();
    runNext();
    sockets[2].close();

    // Doubling, so a server that stays down is not hammered.
    expect(delays.slice(0, 3)).toEqual([500, 1000, 2000]);

    runNext();
    sockets[3].open();
    sockets[3].close();

    // A successful connection resets the delay; without this a long outage would
    // leave the next reconnect minutes away.
    expect(delays[3]).toBe(500);
  });

  it('does not reconnect after a deliberate disconnect', () => {
    const { service, sockets, runNext } = setup();
    service.connect();
    sockets[0].open();

    service.disconnect();
    runNext();

    expect(sockets).toHaveLength(1);
    expect(service.connectionState()).toBe(NotificationConnectionState.Closed);
  });
});
