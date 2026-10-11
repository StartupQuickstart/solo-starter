/**
 * How the browser came back from Stripe Checkout (`/billing?checkout=...`).
 *
 * This module has no `'use client'` directive on purpose: the billing page is
 * a server component and calls `parseCheckoutResult` while rendering. A
 * function exported from a client module cannot be called on the server; Next
 * throws at request time, and neither the compiler nor the unit tests see it.
 */
export const CHECKOUT_RESULT = { success: 'success', canceled: 'canceled' } as const;
export type CheckoutResult = (typeof CHECKOUT_RESULT)[keyof typeof CHECKOUT_RESULT];

/** Read the `checkout` query value; anything unexpected is ignored. */
export function parseCheckoutResult(value: string | string[] | undefined): CheckoutResult | undefined {
  return value === CHECKOUT_RESULT.success || value === CHECKOUT_RESULT.canceled ? value : undefined;
}
