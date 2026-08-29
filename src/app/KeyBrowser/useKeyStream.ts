import { useCallback, useEffect, useRef, useState } from 'react';
import { keysApi } from './api';
import type { ScanParams } from './api';
import type { KeyEntry } from './types';

/** Injectable so tests can drive the stream without a server. */
export type EventSourceFactory = (url: string) => EventSource;

/**
 * Module-level so the default is referentially stable.
 *
 * <p>Written inline as a default parameter it would be a new function on every render, which the
 * effect depends on — so every render tore down the stream and opened another. The scans piled up,
 * each resetting its own counter, and the page limit never applied.
 */
const openEventSource: EventSourceFactory = (url) => new EventSource(url);

export interface KeyStream {
  keys: KeyEntry[];
  /** True while the scan is still running. */
  isStreaming: boolean;
  /** True when the scan was stopped at the limit rather than finishing. */
  isTruncated: boolean;
  /** Current ceiling on collected keys. */
  limit: number;
  /** False once the ceiling cannot be raised any further. */
  canLoadMore: boolean;
  /** Raises the ceiling and scans again. */
  loadMore: () => void;
  /** Discards what was collected and scans again. */
  restart: () => void;
}

/** How often buffered events are handed to React. */
const FLUSH_INTERVAL_MS = 100;

/**
 * How many keys one scan collects before stopping.
 *
 * <p>A page, not a limitation of the server: a keyspace worth browsing is far larger than anyone
 * reads, and holding all of it costs twice over — the array is copied on every flush, which is
 * quadratic over a full scan, and every append re-renders the table mid-scroll. Ten thousand rows
 * is already more than a person will page through before narrowing the filter.
 */
export const DEFAULT_LIMIT = 10_000;

/**
 * The most this page will ever hold, however many times "load more" is pressed.
 *
 * <p>Without a ceiling, repeated presses walk a million-key keyspace into the tab's memory a
 * hundred thousand keys at a time until it is killed — the browser reports that as a crash, and
 * the work done up to that point is lost with it.
 *
 * <p>Two hundred thousand entries is roughly fifty megabytes of JavaScript objects, which a tab
 * carries without trouble. Past that the answer is not more rows but a narrower filter, and saying
 * so is more useful than a page nobody can read to the end of.
 */
export const MAX_LIMIT = 200_000;

/**
 * Consumes the key stream.
 *
 * <p>Keys arrive as server-sent events and are appended in batches rather than one state update
 * per key: at a million keys, re-rendering per event would spend all its time in React instead of
 * showing rows. A scan in flight is abandoned when the filters change, so a slow scan cannot
 * overwrite the results of the one that replaced it.
 */
export const useKeyStream = (
  connectionId: number,
  params: ScanParams,
  createEventSource: EventSourceFactory = openEventSource,
): KeyStream => {
  const { match, type, count, database } = params;
  const [attempt, setAttempt] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  // Identifies one scan. Everything that should start a new scan belongs in here.
  const streamKey = `${connectionId}|${database ?? ''}|${match ?? ''}|${type ?? ''}|${count ?? ''}|${attempt}|${limit}`;

  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [isStreaming, setStreaming] = useState(true);
  const [isTruncated, setTruncated] = useState(false);
  const [activeKey, setActiveKey] = useState(streamKey);

  // Reset during render rather than in an effect. Clearing the old results in an
  // effect would paint the previous scan's rows for a frame and cost an extra
  // render; React handles a render-phase adjustment without committing the stale UI.
  if (streamKey !== activeKey) {
    setActiveKey(streamKey);
    setKeys([]);
    setStreaming(true);
    setTruncated(false);
  }

  // Buffered between flushes so a burst of events costs one render, not hundreds.
  const buffer = useRef<KeyEntry[]>([]);

  const restart = useCallback(() => {
    setLimit(DEFAULT_LIMIT);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = useCallback(
    () => setLimit((current) => Math.min(current + DEFAULT_LIMIT, MAX_LIMIT)),
    [],
  );

  useEffect(() => {
    buffer.current = [];
    const source = createEventSource(
      keysApi.streamUrl(connectionId, { match, type, count, database }),
    );

    let collected = 0;

    const flush = () => {
      if (buffer.current.length === 0) {
        return;
      }
      const batch = buffer.current;
      buffer.current = [];
      setKeys((current) => current.concat(batch));
    };
    const timer = window.setInterval(flush, FLUSH_INTERVAL_MS);

    const stopAtLimit = () => {
      flush();
      setTruncated(true);
      setStreaming(false);
      source.close();
    };

    source.onmessage = (event: MessageEvent<string>) => {
      // A message already in flight when the limit was reached must not push the
      // page over it; close() stops delivery but cannot unsend what was sent.
      if (collected >= limit) {
        return;
      }
      try {
        buffer.current.push(JSON.parse(event.data) as KeyEntry);
      } catch {
        // A malformed frame is not worth tearing the whole stream down for.
        return;
      }
      collected += 1;
      if (collected >= limit) {
        stopAtLimit();
      }
    };
    source.onerror = () => {
      // EventSource reports the end of a finite stream as an error, so this is the
      // normal completion path as well as the failure one. Anything collected stays.
      flush();
      setStreaming(false);
      source.close();
    };

    return () => {
      window.clearInterval(timer);
      source.close();
    };
  }, [connectionId, database, match, type, count, attempt, limit, createEventSource]);

  return {
    keys,
    isStreaming,
    isTruncated,
    limit,
    canLoadMore: limit < MAX_LIMIT,
    loadMore,
    restart,
  };
};
