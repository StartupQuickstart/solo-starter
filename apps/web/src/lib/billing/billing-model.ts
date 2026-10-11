import { z } from 'zod';

/**
 * What `GET /api/v1/billing` answers: the signed-in person's subscription to
 * the one plan. Parsed on arrival, so the screens below trust the shape.
 */
export const billingSchema = z.object({
  /** False when the API has no Stripe keys: the app works, and nothing can be bought. */
  billingEnabled: z.boolean(),
  /** The one question the app asks of billing: may this person use what the plan unlocks. */
  subscribed: z.boolean(),
  /** Stripe's subscription status, or `null` when there has never been a subscription. */
  status: z.string().nullable(),
  plan: z.object({ name: z.string(), priceLabel: z.string().nullable() }),
  /** End of the paid period (ISO 8601), or `null` without a subscription. */
  currentPeriodEnd: z.string().nullable(),
  /** The subscription stops at `currentPeriodEnd` instead of renewing. */
  cancelAtPeriodEnd: z.boolean(),
});

export type Billing = z.infer<typeof billingSchema>;

/** Where Checkout or the customer portal is, on Stripe. */
export const billingRedirectSchema = z.object({ url: z.url() });

export type BillingRedirect = z.infer<typeof billingRedirectSchema>;

export const BILLING_PATH = '/billing';
