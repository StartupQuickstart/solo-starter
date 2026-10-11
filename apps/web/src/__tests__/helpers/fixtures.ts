/**
 * What the API serves, for component tests. Builders take overrides so a test
 * states only what it is about.
 */

export const envelope = <T>(data: T) => ({ success: true, data });

export const page = <T>(items: readonly T[], total: number = items.length, pageSize = 20, pageNumber = 1) => ({
  success: true,
  data: items,
  pagination: { page: pageNumber, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
});

export const failure = (code = 'INTERNAL_SERVER_ERROR', message = 'boom') => ({ success: false, code, message });

/** Billing as the API reports it for someone who has never subscribed. */
export const NOT_SUBSCRIBED = {
  billingEnabled: true,
  subscribed: false,
  status: null,
  plan: { name: 'Pro', priceLabel: '$9 per month' },
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

export const SUBSCRIBED = {
  ...NOT_SUBSCRIBED,
  subscribed: true,
  status: 'active',
  currentPeriodEnd: '2026-10-27T12:00:00.000Z',
};

/** Billing when the API has no Stripe keys. */
export const BILLING_OFF = { ...NOT_SUBSCRIBED, billingEnabled: false, plan: { name: 'Pro', priceLabel: null } };
