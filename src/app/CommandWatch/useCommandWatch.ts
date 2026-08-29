import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandFrame, WatchedCommand } from './types';

/** Injectable so tests can drive the watch without a server. */
export type SocketFactory = (url: string) => WebSocket;

/** Module-level so the default is referentially stable and the effect does not reopen per render. */
const openSocket: SocketFactory = (url) => new WebSocket(url);

export const WatchState = {
  Idle: 'idle',
  Connecting: 'connecting',
  Watching: 'watching',
  Closed: 'closed',
} as const;

export type WatchState = (typeof WatchState)[keyof typeof WatchState];

export interface CommandWatch {
  commands: WatchedCommand[];
  state: WatchState;
  /** How many the server discarded because this reader was behind. */
  dropped: number;
  start: () => void;
  stop: () => void;
  clear: () => void;
}

/**
 * A live view of what a target is being asked to do.
 *
 * <p>Kept off until asked for, unlike the console's socket. Watching is the most expensive thing a
 * client can ask of a server — every command it runs is copied to every watcher — so opening it as
 * a side effect of visiting a page would make the page a cost rather than a view.
 *
 * <p>Only the last {@link limit} commands are held. A busy server produces more in a minute than a
 * browser can hold, and a list that grows until the tab dies is not a monitoring tool.
 */
export const useCommandWatch = (
  connectionId: number,
  limit = 2000,
  createSocket: SocketFactory = openSocket,
): CommandWatch => {
  const [commands, setCommands] = useState<WatchedCommand[]>([]);
  const [state, setState] = useState<WatchState>(WatchState.Idle);
  const [dropped, setDropped] = useState(0);
  const [isWanted, setWanted] = useState(false);
  const [watchFor, setWatchFor] = useState(connectionId);
  const socket = useRef<WebSocket | null>(null);
  const nextId = useRef(0);

  // Changing target ends the watch rather than carrying it over: the commands on screen
  // came from a different server and would go on being read as if they had not.
  if (watchFor !== connectionId) {
    setWatchFor(connectionId);
    setWanted(false);
    setCommands([]);
    setDropped(0);
    setState(WatchState.Idle);
  }

  useEffect(() => {
    if (!isWanted) {
      return undefined;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const opened = createSocket(
      `${protocol}//${window.location.host}/api/v1/connections/${connectionId}/commands`,
    );
    socket.current = opened;

    opened.onopen = () => setState(WatchState.Watching);
    opened.onclose = () => setState(WatchState.Closed);
    opened.onerror = () => setState(WatchState.Closed);
    opened.onmessage = (event: MessageEvent<string>) => {
      const frame = JSON.parse(event.data) as CommandFrame;
      if (frame.dropped > 0) {
        setDropped((total) => total + frame.dropped);
      }
      setCommands((current) => {
        const next = [{ ...frame, id: nextId.current++ }, ...current];
        return next.length > limit ? next.slice(0, limit) : next;
      });
    };

    return () => {
      opened.close();
      socket.current = null;
    };
  }, [connectionId, createSocket, isWanted, limit]);

  // Connecting is set here rather than in the effect that opens the socket: the effect runs
  // as a consequence of wanting to watch, and a state change inside it is a second render
  // for something already known at the moment the button was pressed.
  const start = useCallback(() => {
    setWanted(true);
    setState(WatchState.Connecting);
  }, []);
  const stop = useCallback(() => {
    setWanted(false);
    setState(WatchState.Idle);
  }, []);
  const clear = useCallback(() => {
    setCommands([]);
    setDropped(0);
  }, []);

  return { commands, state, dropped, start, stop, clear };
};
