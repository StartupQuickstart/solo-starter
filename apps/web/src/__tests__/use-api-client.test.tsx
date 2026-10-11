import { ApiClientError } from '@app/ui';
import { renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useApiClient, useApiDownload } from '@/lib/api-client';

// Clerk's session: by default there is a token to send.
const mocks = vi.hoisted(() => ({
  useAuth: vi.fn<() => { getToken: () => Promise<string | null> }>(() => ({
    getToken: async () => 'session-token',
  })),
}));

vi.mock('@clerk/nextjs', () => ({ useAuth: mocks.useAuth }));

// A stand-in for the API that records the Authorization header it was sent.
let capturedAuthHeader: string | null = null;

const server = setupServer(
  http.get('http://api.test/api/v1/test', ({ request }) => {
    capturedAuthHeader = request.headers.get('Authorization');
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),
  http.get('http://api.test/api/v1/file', ({ request }) => {
    capturedAuthHeader = request.headers.get('Authorization');
    return new HttpResponse('title,body\n', { headers: { 'Content-Type': 'text/csv' } });
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  capturedAuthHeader = null;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('useApiClient', () => {
  it('returns an object with HTTP method functions', () => {
    const { result } = renderHook(() => useApiClient());
    const client = result.current;

    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('sends the Clerk session token as a bearer token, to the path as written', async () => {
    const { result } = renderHook(() => useApiClient());

    await expect(result.current.get('/api/v1/test')).resolves.toEqual({ ok: true });

    expect(capturedAuthHeader).toBe('Bearer session-token');
  });

  it('sends no Authorization header when there is no session', async () => {
    mocks.useAuth.mockReturnValueOnce({ getToken: async () => null });

    const { result } = renderHook(() => useApiClient());
    await result.current.get('/api/v1/test');

    expect(capturedAuthHeader).toBeNull();
  });
});

describe('useApiDownload', () => {
  it('fetches a file with the same bearer token', async () => {
    const { result } = renderHook(() => useApiDownload());

    const file = await result.current('/api/v1/file');

    expect(await file.text()).toBe('title,body\n');
    expect(capturedAuthHeader).toBe('Bearer session-token');
  });

  it("fails with the API's code and message when the API refuses", async () => {
    server.use(
      http.get('http://api.test/api/v1/file', () =>
        HttpResponse.json({ success: false, code: 'SUBSCRIPTION_REQUIRED', message: 'A subscription is required' }, { status: 403 }),
      ),
    );
    const { result } = renderHook(() => useApiDownload());

    const error: unknown = await result.current('/api/v1/file').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 403, errorCode: 'SUBSCRIPTION_REQUIRED', message: 'A subscription is required' });
  });

  it('still fails clearly when the refusal is not the JSON envelope', async () => {
    server.use(http.get('http://api.test/api/v1/file', () => new HttpResponse('Bad gateway', { status: 502 })));
    const { result } = renderHook(() => useApiDownload());

    await expect(result.current('/api/v1/file')).rejects.toMatchObject({ status: 502, errorCode: 'API_ERROR' });
  });
});
