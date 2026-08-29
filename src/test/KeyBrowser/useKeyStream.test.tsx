import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_LIMIT, useKeyStream } from '@app/KeyBrowser/useKeyStream';
import { FakeEventSource } from './eventSource';

const factory = (url: string) => new FakeEventSource(url) as unknown as EventSource;

describe('useKeyStream', () => {
  beforeEach(() => FakeEventSource.reset());

  it('collects keys as they arrive and reports when the scan ends', async () => {
    const { result } = renderHook(() => useKeyStream(1, {}, factory));

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      FakeEventSource.latest().emit({ key: 'a', type: 'string', ttl: -1 });
      FakeEventSource.latest().emit({ key: 'b', type: 'hash', ttl: 60 });
    });

    await waitFor(() => expect(result.current.keys).toHaveLength(2));
    expect(result.current.keys.map((k) => k.key)).toEqual(['a', 'b']);

    act(() => FakeEventSource.latest().finish());
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });

  it('passes the filters to the server rather than filtering locally', () => {
    renderHook(() => useKeyStream(7, { match: 'user:*', type: 'hash' }, factory));

    const url = FakeEventSource.latest().url;
    expect(url).toContain('/api/v1/connections/7/keys');
    expect(url).toContain('match=user%3A*');
    expect(url).toContain('type=hash');
  });

  it('abandons the running scan when the filters change', async () => {
    const { rerender, result } = renderHook(
      ({ match }: { match: string }) => useKeyStream(1, { match }, factory),
      { initialProps: { match: 'a*' } },
    );

    act(() => FakeEventSource.latest().emit({ key: 'a1', type: 'string', ttl: -1 }));
    await waitFor(() => expect(result.current.keys).toHaveLength(1));

    const first = FakeEventSource.latest();
    rerender({ match: 'b*' });

    // The old stream is closed and its results discarded, so a slow scan cannot
    // overwrite the one that replaced it.
    expect(first.closed).toBe(true);
    expect(result.current.keys).toHaveLength(0);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('rescans on demand', async () => {
    const { result } = renderHook(() => useKeyStream(1, {}, factory));

    act(() => FakeEventSource.latest().emit({ key: 'a', type: 'string', ttl: -1 }));
    await waitFor(() => expect(result.current.keys).toHaveLength(1));

    act(() => result.current.restart());

    expect(result.current.keys).toHaveLength(0);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('stops at the page limit instead of collecting the whole keyspace', async () => {
    const { result } = renderHook(() => useKeyStream(1, {}, factory));
    const source = FakeEventSource.latest();

    // One more than a page: the extra must not arrive, and the scan must stop.
    act(() => {
      for (let i = 0; i <= DEFAULT_LIMIT; i++) {
        source.emit({ key: `k${i}`, type: 'string', ttl: -1 });
      }
    });

    await waitFor(() => expect(result.current.isTruncated).toBe(true));
    expect(result.current.keys).toHaveLength(DEFAULT_LIMIT);
    expect(result.current.isStreaming).toBe(false);
    // The server is told to stop rather than being left producing keys nobody reads.
    expect(source.closed).toBe(true);
  });

  it('raises the ceiling on demand', async () => {
    const { result } = renderHook(() => useKeyStream(1, {}, factory));

    act(() => {
      for (let i = 0; i <= DEFAULT_LIMIT; i++) {
        FakeEventSource.latest().emit({ key: `k${i}`, type: 'string', ttl: -1 });
      }
    });
    await waitFor(() => expect(result.current.isTruncated).toBe(true));

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.limit).toBe(DEFAULT_LIMIT * 2));
    expect(result.current.isTruncated).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('ignores a malformed frame instead of losing the stream', async () => {
    const { result } = renderHook(() => useKeyStream(1, {}, factory));

    act(() => {
      FakeEventSource.latest().onmessage?.({ data: 'not json' } as MessageEvent<string>);
      FakeEventSource.latest().emit({ key: 'survivor', type: 'string', ttl: -1 });
    });

    await waitFor(() => expect(result.current.keys).toHaveLength(1));
    expect(result.current.keys[0].key).toBe('survivor');
  });
});
