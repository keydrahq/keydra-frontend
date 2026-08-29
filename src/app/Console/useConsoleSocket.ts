import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsoleResult, TranscriptEntry } from './types';

/** Injectable so tests can drive the session without a server. */
export type SocketFactory = (url: string) => WebSocket;

/** Module-level so the default is referentially stable and the effect does not reopen per render. */
const openSocket: SocketFactory = (url) => new WebSocket(url);

export const ConsoleState = {
  Connecting: 'connecting',
  Open: 'open',
  Closed: 'closed',
} as const;

export type ConsoleState = (typeof ConsoleState)[keyof typeof ConsoleState];

export interface ConsoleSession {
  transcript: TranscriptEntry[];
  state: ConsoleState;
  /** Sends a line and adds it to the transcript straight away. */
  send: (line: string) => void;
  /** Records a line the client itself declined to send, with the reason. */
  refuse: (line: string, reason: string) => void;
  clear: () => void;
}

/**
 * One console session over a WebSocket.
 *
 * <p>The line is put in the transcript when it is sent, not when the reply arrives: a command that
 * takes a second to answer should still appear the moment it was run, in the order it was typed.
 * Replies are matched back by the id they carry, so a fast reply cannot be attached to a slow
 * command that happened to be sent first.
 */
export const useConsoleSocket = (
  connectionId: number,
  createSocket: SocketFactory = openSocket,
): ConsoleSession => {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [state, setState] = useState<ConsoleState>(ConsoleState.Connecting);
  const [sessionFor, setSessionFor] = useState(connectionId);
  const socket = useRef<WebSocket | null>(null);
  const nextId = useRef(0);

  // Changing target starts a new session. Adjusted during render rather than in the
  // effect, so the transcript of the previous target is never painted under the new
  // one's heading — and so the reset costs no extra render.
  if (sessionFor !== connectionId) {
    setSessionFor(connectionId);
    setTranscript([]);
    setState(ConsoleState.Connecting);
  }

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const opened = createSocket(
      `${protocol}//${window.location.host}/api/v1/connections/${connectionId}/console`,
    );
    socket.current = opened;

    opened.onopen = () => setState(ConsoleState.Open);
    opened.onclose = () => setState(ConsoleState.Closed);
    opened.onerror = () => setState(ConsoleState.Closed);
    opened.onmessage = (event: MessageEvent<string>) => {
      let result: ConsoleResult;
      try {
        result = JSON.parse(event.data) as ConsoleResult;
      } catch {
        // A frame that is not a result is not worth tearing the session down for.
        return;
      }
      setTranscript((current) =>
        current.map((entry) => (entry.id === result.id ? { ...entry, result } : entry)),
      );
    };

    return () => {
      socket.current = null;
      opened.close();
    };
  }, [connectionId, createSocket]);

  const send = useCallback((line: string) => {
    const trimmed = line.trim();
    if (trimmed === '' || socket.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    nextId.current += 1;
    const id = `command-${nextId.current}`;
    setTranscript((current) => [...current, { id, line: trimmed }]);
    socket.current.send(JSON.stringify({ id, line: trimmed }));
  }, []);

  const refuse = useCallback((line: string, reason: string) => {
    const trimmed = line.trim();
    if (trimmed === '') {
      return;
    }
    nextId.current += 1;
    const id = `command-${nextId.current}`;
    // Written straight into the transcript with its answer: nothing was sent, so no
    // reply will arrive to fill it in later.
    setTranscript((current) => [
      ...current,
      {
        id,
        line: trimmed,
        result: { id, line: trimmed, value: { kind: 'error', message: reason }, durationMs: 0 },
      },
    ]);
  }, []);

  const clear = useCallback(() => setTranscript([]), []);

  return { transcript, state, send, refuse, clear };
};
