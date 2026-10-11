'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/lib/api-client';
import { billingRedirectSchema, billingSchema } from '@/lib/billing/billing-model';

// The query cache belongs to one person (src/lib/providers.tsx), so the key names only what is asked for.
const BILLING_KEY = ['billing'] as const;

/** How often, and how many times, billing is re-read while a purchase is being confirmed. */
export const SUBSCRIPTION_POLL = { intervalMs: 2_000, maxAttempts: 15 } as const;

const STALE_MS = 30_000;

export interface UseBillingOptions {
  /**
   * Re-read every couple of seconds until the person is subscribed. Used after
   * returning from Checkout: the subscription is recorded by Stripe's webhook,
   * which usually lands within a few seconds of the redirect, not before it.
   */
  readonly awaitSubscription?: boolean;
}

/**
 * The signed-in person's billing state (`GET /billing`): whether billing is
 * switched on, whether they are subscribed, and when the period ends.
 *
 * @returns TanStack Query result with the parsed billing state
 */
export function useBilling({ awaitSubscription = false }: UseBillingOptions = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: BILLING_KEY,
    queryFn: async () => billingSchema.parse(await api.get<unknown>('/api/v1/billing')),
    staleTime: STALE_MS,
    refetchInterval: (query) => {
      if (!awaitSubscription || query.state.data?.subscribed) return false;
      return query.state.dataUpdateCount < SUBSCRIPTION_POLL.maxAttempts ? SUBSCRIPTION_POLL.intervalMs : false;
    },
  });
}

/**
 * Whether the signed-in person is subscribed: the web side of the one gate.
 * `false` until billing has loaded, so a gated control starts locked. It only
 * decides what to show; the API refuses the gated request regardless.
 */
export function useIsSubscribed(): boolean {
  return useBilling().data?.subscribed === true;
}

/**
 * Start Stripe Checkout for the plan (`POST /billing/checkout`). Resolves with
 * `{ url }`; the caller sends the browser there. Nothing changes until Stripe
 * confirms the payment to the API.
 */
export function useCheckout() {
  const api = useApiClient();

  return useMutation({
    mutationFn: async () => billingRedirectSchema.parse(await api.post<unknown>('/api/v1/billing/checkout', {})),
  });
}

/**
 * Open the Stripe customer portal (`POST /billing/portal`), where the person
 * updates the card, reads invoices or cancels. Resolves with `{ url }`; the
 * caller sends the browser there.
 */
export function usePortal() {
  const api = useApiClient();

  return useMutation({
    mutationFn: async () => billingRedirectSchema.parse(await api.post<unknown>('/api/v1/billing/portal', {})),
  });
}
