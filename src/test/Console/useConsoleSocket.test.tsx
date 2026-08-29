import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useConsoleSocket, ConsoleState } from '@app/Console/useConsoleSocket';
import { FakeSocket, fakeSocketFactory } from './socket';

describe('useConsoleSocket', () => {
  beforeEach(() => FakeSocket.reset());

  const openSession = () => {
    const rendered = renderHook(() => useConsoleSocket(1, fakeSocketFactory));
    act(() => FakeSocket.latest().open());
    return rendered;
  };

  it('opens a socket for the connection it was given', () => {
    openSession();

    expect(FakeSocket.latest().url).toContain('/api/v1/connections/1/console');
  });

  it('shows a command in the transcript before its reply arrives', () => {
    const { result } = openSession();

    act(() => result.current.send('GET a'));

    // The line appears immediately; a slow command must not vanish until it answers.
    expect(result.current.transcript).toHaveLength(1);
    expect(result.current.transcript[0].line).toBe('GET a');
    expect(result.current.transcript[0].result).toBeUndefined();
  });

  it('attaches a reply to the command that carried its id', async () => {
    const { result } = openSession();
    act(() => result.current.send('GET a'));
    act(() => result.current.send('GET b'));

    const [first, second] = FakeSocket.latest().commands();
    // The second command answers first, which is exactly what ids are for.
    act(() =>
      FakeSocket.latest().reply({
        id: second.id,
        line: second.line,
        value: { kind: 'text', value: 'b-value' },
        durationMs: 1,
      }),
    );

    await waitFor(() => expect(result.current.transcript[1].result).toBeDefined());
    expect(result.current.transcript[1].result?.value).toEqual({
      kind: 'text',
      value: 'b-value',
    });
    // The first is still waiting, not mistakenly answered.
    expect(result.current.transcript[0].result).toBeUndefined();
    expect(first.line).toBe('GET a');
  });

  it('sends nothing for a blank line', () => {
    const { result } = openSession();

    act(() => result.current.send('   '));

    expect(FakeSocket.latest().sent).toHaveLength(0);
    expect(result.current.transcript).toHaveLength(0);
  });

  it('refuses to send once the socket has dropped', () => {
    const { result } = openSession();
    act(() => FakeSocket.latest().drop());

    act(() => result.current.send('GET a'));

    expect(result.current.state).toBe(ConsoleState.Closed);
    expect(FakeSocket.latest().sent).toHaveLength(0);
  });

  it('survives a frame that is not a result', () => {
    const { result } = openSession();
    act(() => result.current.send('GET a'));

    act(() => FakeSocket.latest().onmessage?.(new MessageEvent('message', { data: 'not json' })));

    expect(result.current.state).toBe(ConsoleState.Open);
    expect(result.current.transcript).toHaveLength(1);
  });

  it('clears the transcript when asked', () => {
    const { result } = openSession();
    act(() => result.current.send('GET a'));

    act(() => result.current.clear());

    expect(result.current.transcript).toHaveLength(0);
  });

  it('records a refused line without sending it', () => {
    const { result } = openSession();

    act(() => result.current.refuse('MONITOR', 'not allowed'));

    // Nothing went to the server, and the answer is already in the transcript.
    expect(FakeSocket.latest().sent).toHaveLength(0);
    expect(result.current.transcript[0].line).toBe('MONITOR');
    expect(result.current.transcript[0].result?.value).toEqual({
      kind: 'error',
      message: 'not allowed',
    });
  });
});
