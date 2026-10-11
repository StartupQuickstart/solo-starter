import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { NOT_SUBSCRIBED, SUBSCRIBED, envelope, failure } from '@/__tests__/helpers/fixtures';
import { useBilling, useCheckout, useIsSubscribed, usePortal } from '@/lib/hooks/useBilling';

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

const server = setupServer(
  http.get('*/api/v1/billing', () => HttpResponse.json(envelope(NOT_SUBSCRIBED))),
  http.post('*/api/v1/billing/checkout', () => HttpResponse.json(envelope({ url: 'https://stripe.test/checkout' }))),
  http.post('*/api/v1/billing/portal', () => HttpResponse.json(envelope({ url: 'https://stripe.test/portal' }))),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useBilling', () => {
  it('unwraps the envelope into the billing state', async () => {
    const { result } = renderHook(() => useBilling(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(NOT_SUBSCRIBED);
  });

  it('surfaces an error when the request fails', async () => {
    server.use(http.get('*/api/v1/billing', () => HttpResponse.json(failure(), { status: 500 })));

    const { result } = renderHook(() => useBilling(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('refuses an answer that is not the shape the API promises', async () => {
    server.use(http.get('*/api/v1/billing', () => HttpResponse.json(envelope({ subscribed: 'yes' }))));

    const { result } = renderHook(() => useBilling(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useIsSubscribed', () => {
  it('is false until billing has loaded, then follows the API', async () => {
    server.use(http.get('*/api/v1/billing', () => HttpResponse.json(envelope(SUBSCRIBED))));

    const { result } = renderHook(() => useIsSubscribed(), { wrapper: makeWrapper() });

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false for someone who is not subscribed', async () => {
    const wrapper = makeWrapper();
    const billing = renderHook(() => useBilling(), { wrapper });
    const { result } = renderHook(() => useIsSubscribed(), { wrapper });

    await waitFor(() => expect(billing.result.current.isSuccess).toBe(true));
    expect(result.current).toBe(false);
  });
});

describe('useCheckout', () => {
  it('resolves with the Checkout URL', async () => {
    const { result } = renderHook(() => useCheckout(), { wrapper: makeWrapper() });

    await expect(result.current.mutateAsync()).resolves.toEqual({ url: 'https://stripe.test/checkout' });
  });

  it('rejects with the API message when Checkout cannot be started', async () => {
    server.use(
      http.post('*/api/v1/billing/checkout', () =>
        HttpResponse.json(failure('ALREADY_SUBSCRIBED', 'You already have a subscription'), { status: 409 }),
      ),
    );
    const { result } = renderHook(() => useCheckout(), { wrapper: makeWrapper() });

    await expect(result.current.mutateAsync()).rejects.toThrow('You already have a subscription');
  });
});

describe('usePortal', () => {
  it('resolves with the portal URL', async () => {
    const { result } = renderHook(() => usePortal(), { wrapper: makeWrapper() });

    await expect(result.current.mutateAsync()).resolves.toEqual({ url: 'https://stripe.test/portal' });
  });
});
