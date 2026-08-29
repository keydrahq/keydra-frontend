import type { FetchFn } from './service.types';

/** Raised for any non-2xx response; carries the status so callers can branch on it. */
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  /**
   * What the server said, when it said anything.
   *
   * <p>The refusals worth showing a person are written as sentences by the backend — which
   * permission was missing, which name was taken — and a dialog that replaced them with "409"
   * would be throwing away the only part anybody can act on.
   */
  readonly detail?: string;

  /**
   * What came back with the refusal.
   *
   * <p>Carried because one refusal is not like the others: a sign-in that fails because the
   * password was wrong and one that fails because a code is wanted are the same status with the
   * same empty body, and only a header tells them apart. Form authentication writes that response
   * itself, so there is nowhere else to put it.
   */
  readonly headers: Headers;

  constructor(
    status: number,
    statusText: string,
    url: string,
    detail?: string,
    headers: Headers = new Headers(),
  ) {
    super(detail?.trim() ? detail : `Request to ${url} failed: ${status} ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.detail = detail?.trim() || undefined;
    this.headers = headers;
  }
}

/**
 * Typed fetch wrapper for the versioned backend API.
 *
 * Follows cryostat-web's plain-class service convention, but returns promises
 * rather than observables so TanStack Query owns caching and retries.
 */
export class ApiService {
  private readonly basePath: string;
  private readonly fetchFn: FetchFn;

  constructor(basePath = '/api/v1', fetchFn: FetchFn = (input, init) => fetch(input, init)) {
    this.basePath = basePath;
    this.fetchFn = fetchFn;
  }

  doGet<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  doPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  doPut<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  doDelete<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  /**
   * Posts form fields rather than JSON.
   *
   * <p>Only signing in needs this, and it needs it because the password is checked by the
   * framework's own form authentication before a request ever reaches the application. That is
   * the point: the one piece of code in Keydra that reads a password is the one written for it.
   */
  doPostForm<T>(path: string, fields: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
  }

  /** Absolute URL for a path, used for the notification WebSocket among others. */
  url(path: string): string {
    return `${this.basePath}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = this.url(path);
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await this.fetchFn(url, { ...init, headers });
    if (!response.ok) {
      throw new ApiError(
        response.status,
        response.statusText,
        url,
        await bodyOf(response),
        response.headers,
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    // Signing in answers 200 with nothing in it — the answer is the cookie. Asking for JSON
    // that is not there would turn a successful login into a parse error.
    if (!response.headers.get('Content-Type')?.includes('json')) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}

/**
 * The failure message, if the response carried one.
 *
 * <p>Best effort by design: a body that cannot be read is not a reason to lose the status code
 * that came with it, so this never throws.
 */
const bodyOf = async (response: Response): Promise<string | undefined> => {
  try {
    const text = await response.text();
    return text.length > 0 && text.length < 500 ? text : undefined;
  } catch {
    return undefined;
  }
};
