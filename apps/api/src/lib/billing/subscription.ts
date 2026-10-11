/**
 * The one rule for "is this user subscribed".
 *
 * Everything that needs the answer calls `isSubscribed` with the status the
 * Stripe webhook stored on the user (`User.subscriptionStatus`): the gate on
 * a paid feature (`requireSubscription`), the billing page, Checkout's
 * "already subscribed" check and the webhook itself.
 */

/** Stripe's subscription statuses. */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  UNPAID: 'unpaid',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  PAUSED: 'paused',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

/**
 * The statuses that count as subscribed: `active` and `trialing`, and also
 * `past_due`.
 *
 * `past_due` means a renewal payment failed and Stripe is still retrying it.
 * The user keeps access while they fix their payment method: Stripe's
 * guidance is to notify on `past_due` and to revoke access on `canceled` or
 * `unpaid`, which is what a subscription becomes when every retry has failed
 * (a setting in the Stripe dashboard). To cut access at the first failed
 * payment instead, remove `PAST_DUE` from this set; nothing else changes.
 */
const SUBSCRIBED_STATUSES: ReadonlySet<string> = new Set<SubscriptionStatus>([
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.TRIALING,
  SUBSCRIPTION_STATUS.PAST_DUE,
]);

/**
 * Whether a subscription in `status` makes its user a subscriber.
 *
 * @param status - Stripe's subscription status as stored, or nothing when the user never subscribed.
 */
export function isSubscribed(status: string | null | undefined): boolean {
  return typeof status === 'string' && SUBSCRIBED_STATUSES.has(status);
}
