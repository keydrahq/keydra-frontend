import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '@app/Shared/Services/Api.service';
import type { FetchFn } from '@app/Shared/Services/service.types';

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200, ...init }));

describe('ApiService', () => {
  it('prefixes paths with the API version and requests JSON', async () => {
    const fetchFn = vi.fn<FetchFn>(() => jsonResponse({ ok: true }));
    const api = new ApiService('/api/v1', fetchFn);

    await api.doGet('/about');

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/v1/about');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
  });

  it('serialises POST bodies and sets the content type', async () => {
    const fetchFn = vi.fn<FetchFn>(() => jsonResponse({}));
    const api = new ApiService('/api/v1', fetchFn);

    await api.doPost('/connections', { name: 'local' });

    const [, init] = fetchFn.mock.calls[0];
    expect(init?.body).toBe('{"name":"local"}');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('throws ApiError carrying the status for non-2xx responses', async () => {
    const fetchFn = vi.fn<FetchFn>(() =>
      Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' })),
    );
    const api = new ApiService('/api/v1', fetchFn);

    await expect(api.doGet('/missing')).rejects.toBeInstanceOf(ApiError);
    await expect(api.doGet('/missing')).rejects.toMatchObject({ status: 404 });
  });

  it('returns undefined for 204 responses instead of parsing an empty body', async () => {
    const fetchFn = vi.fn<FetchFn>(() => Promise.resolve(new Response(null, { status: 204 })));
    const api = new ApiService('/api/v1', fetchFn);

    await expect(api.doDelete('/connections/1')).resolves.toBeUndefined();
  });
});
