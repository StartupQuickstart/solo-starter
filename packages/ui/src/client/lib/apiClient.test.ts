import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError, createApiClient } from './apiClient';

const BASE_URL = 'https://api.test';

interface RecordedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Replaces the global `fetch` with one that answers from `respond` and
 * records what it was asked. Returns the recorded requests.
 */
function serve(respond: (request: RecordedRequest) => Response | Promise<Response>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const request = { url, init };
    requests.push(request);
    return respond(request);
  });
  return requests;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** A server that never answers: the request ends only when it is aborted, as `fetch` ends it. */
function neverAnswers({ init }: RecordedRequest): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
  });
}

async function failure(promise: Promise<unknown>): Promise<ApiClientError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiClientError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createApiClient: requests', () => {
  it('unwraps the data of a success envelope', async () => {
    serve(() => json({ success: true, data: { id: 'u1' } }));

    await expect(createApiClient({ baseUrl: BASE_URL }).get('/users/u1')).resolves.toEqual({ id: 'u1' });
  });

  it('prepends the base URL after transforming the path', async () => {
    const requests = serve(() => json({ success: true, data: null }));
    const api = createApiClient({ baseUrl: BASE_URL, transformUrl: (url) => url.replace('/api/v1', '/api/v1/beta') });

    await api.get('/api/v1/notes');

    expect(requests[0]?.url).toBe('https://api.test/api/v1/beta/notes');
  });

  it('sends a body as JSON with its content type', async () => {
    const requests = serve(() => json({ success: true, data: null }));

    await createApiClient({ baseUrl: BASE_URL }).post('/things', { name: 'A' });

    expect(requests[0]?.init.method).toBe('POST');
    expect(requests[0]?.init.body).toBe('{"name":"A"}');
    expect(requests[0]?.init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('sends no body and no content type on a request without one', async () => {
    const requests = serve(() => json({ success: true, data: null }));

    await createApiClient({ baseUrl: BASE_URL }).delete('/things/1');

    expect(requests[0]?.init.body).toBeUndefined();
    expect(requests[0]?.init.headers).not.toHaveProperty('Content-Type');
  });

  it('lets the request interceptor add headers, such as the session token', async () => {
    const requests = serve(() => json({ success: true, data: null }));
    const api = createApiClient({
      baseUrl: BASE_URL,
      onRequest: (_url, options) => ({ ...options, headers: { ...options.headers, Authorization: 'Bearer token' } }),
    });

    await api.get('/me');

    expect(requests[0]?.init.headers).toMatchObject({ Authorization: 'Bearer token' });
  });

  it('resolves with undefined for 204 No Content', async () => {
    serve(() => new Response(null, { status: 204 }));

    await expect(createApiClient({ baseUrl: BASE_URL }).delete('/things/1')).resolves.toBeUndefined();
  });
});

describe('createApiClient: paginated lists', () => {
  it('returns the items together with the pagination block', async () => {
    const pagination = { page: 2, pageSize: 10, total: 25, totalPages: 3 };
    serve(() => json({ success: true, data: [{ id: 'a' }], pagination }));

    await expect(createApiClient({ baseUrl: BASE_URL }).getPage('/things?page=2')).resolves.toEqual({
      items: [{ id: 'a' }],
      pagination,
    });
  });

  it('rejects a list response that carries no pagination', async () => {
    serve(() => json({ success: true, data: [] }));

    const error = await failure(createApiClient({ baseUrl: BASE_URL }).getPage('/things'));

    expect(error.errorCode).toBe('INVALID_RESPONSE');
  });
});

describe('createApiClient: failures', () => {
  it('carries the status, code, message and details of an error envelope', async () => {
    serve(() =>
      json({ success: false, code: 'PLAN_REQUIRED', message: 'Upgrade to use this', details: { required: 'pro' } }, 403),
    );

    const error = await failure(createApiClient({ baseUrl: BASE_URL }).get('/reports'));

    expect(error).toMatchObject({
      status: 403,
      errorCode: 'PLAN_REQUIRED',
      message: 'Upgrade to use this',
      details: { required: 'pro' },
      url: 'https://api.test/reports',
    });
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    serve(() => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));

    const error = await failure(createApiClient({ baseUrl: BASE_URL }).get('/reports'));

    expect(error).toMatchObject({ status: 502, errorCode: 'API_ERROR', message: 'Bad Gateway' });
  });

  it('reports a network failure with its own code', async () => {
    serve(() => {
      throw new TypeError('fetch failed');
    });

    const error = await failure(createApiClient({ baseUrl: BASE_URL }).get('/reports'));

    expect(error).toMatchObject({ status: 0, errorCode: 'NETWORK_ERROR', message: 'fetch failed' });
  });

  it('gives up with TIMEOUT when the server does not answer in time', async () => {
    vi.useFakeTimers();
    serve(neverAnswers);

    const pending = failure(createApiClient({ baseUrl: BASE_URL, timeout: 5_000 }).get('/slow'));
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await pending).toMatchObject({ status: 0, errorCode: 'TIMEOUT' });
  });

  it('reports a request the caller aborted as aborted, not as a timeout', async () => {
    serve(neverAnswers);
    const controller = new AbortController();

    const pending = failure(createApiClient({ baseUrl: BASE_URL }).get('/slow', { signal: controller.signal }));
    controller.abort();

    expect(await pending).toMatchObject({ status: 0, errorCode: 'ABORTED' });
  });

  it('tells the error interceptor about every failure, then still rejects', async () => {
    serve(() => json({ success: false, code: 'UNAUTHORIZED', message: 'Sign in' }, 401));
    const seen: ApiClientError[] = [];
    const api = createApiClient({ baseUrl: BASE_URL, onError: (error) => void seen.push(error) });

    const error = await failure(api.get('/me'));

    expect(seen).toEqual([error]);
  });
});
