import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { WatchState, useCommandWatch } from '@app/CommandWatch/useCommandWatch';
import { FakeSocket, fakeSocketFactory } from '../Console/socket';
import type { CommandFrame } from '@app/CommandWatch/types';

const frame = (over: Partial<CommandFrame> = {}): CommandFrame => ({
  atMicros: 1_700_000_000_000_000,
  database: 0,
  client: '127.0.0.1:1234',
  name: 'GET',
  arguments: ['a'],
  dropped: 0,
  ...over,
});

describe('useCommandWatch', () => {
  beforeEach(() => FakeSocket.reset());

  const start = (connectionId = 1, limit = 2000) => {
    const rendered = renderHook(() => useCommandWatch(connectionId, limit, fakeSocketFactory));
    act(() => rendered.result.current.start());
    act(() => FakeSocket.latest().open());
    return rendered;
  };

  it('opens nothing until somebody asks to watch', () => {
    const { result } = renderHook(() => useCommandWatch(1, 2000, fakeSocketFactory));

    // Watching copies every command the server runs to this reader, so visiting the page
    // must not start it.
    expect(FakeSocket.instances).toHaveLength(0);
    expect(result.current.state).toBe(WatchState.Idle);
  });

  it('opens a socket for the connection it was given', () => {
    start(7);

    expect(FakeSocket.latest().url).toContain('/api/v1/connections/7/commands');
  });

  it('shows the newest command first', () => {
    const { result } = start();

    act(() => FakeSocket.latest().receive(JSON.stringify(frame({ arguments: ['first'] }))));
    act(() => FakeSocket.latest().receive(JSON.stringify(frame({ arguments: ['second'] }))));

    // A log people watch is read from the top: the thing that just happened should not be
    // somewhere below the fold.
    expect(result.current.commands.map((c) => c.arguments[0])).toEqual(['second', 'first']);
  });

  it('keeps only the most recent commands', () => {
    const { result } = start(1, 3);

    for (let i = 0; i < 5; i++) {
      act(() => FakeSocket.latest().receive(JSON.stringify(frame({ arguments: [String(i)] }))));
    }

    // A busy server produces more in a minute than a browser can hold, and a list that
    // grows until the tab dies is not a monitoring tool.
    expect(result.current.commands).toHaveLength(3);
    expect(result.current.commands.map((c) => c.arguments[0])).toEqual(['4', '3', '2']);
  });

  it('adds up what the server said it discarded', () => {
    const { result } = start();

    act(() => FakeSocket.latest().receive(JSON.stringify(frame({ dropped: 12 }))));
    act(() => FakeSocket.latest().receive(JSON.stringify(frame({ dropped: 5 }))));

    expect(result.current.dropped).toBe(17);
  });

  it('closes the socket when watching is stopped', () => {
    const { result } = start();
    const socket = FakeSocket.latest();

    act(() => result.current.stop());

    expect(socket.closed).toBe(true);
    expect(result.current.state).toBe(WatchState.Idle);
  });

  it('drops what it was showing when the target changes', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useCommandWatch(id, 2000, fakeSocketFactory),
      { initialProps: { id: 1 } },
    );
    act(() => result.current.start());
    act(() => FakeSocket.latest().open());
    act(() => FakeSocket.latest().receive(JSON.stringify(frame())));

    rerender({ id: 2 });

    // The commands on screen came from a different server, and would go on being read as
    // if they had not.
    expect(result.current.commands).toHaveLength(0);
    expect(result.current.state).toBe(WatchState.Idle);
  });

  it('clears what is on screen without stopping the watch', () => {
    const { result } = start();
    act(() => FakeSocket.latest().receive(JSON.stringify(frame({ dropped: 3 }))));

    act(() => result.current.clear());

    expect(result.current.commands).toHaveLength(0);
    expect(result.current.dropped).toBe(0);
    expect(result.current.state).toBe(WatchState.Watching);
  });
});
