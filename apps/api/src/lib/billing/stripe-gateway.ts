import Stripe from 'stripe';

import {
  InvalidWebhookSignatureError,
  type BillingGateway,
  type CreateCheckoutSessionInput,
  type CreateCustomerInput,
  type CreatePortalSessionInput,
  type PriceSnapshot,
  type SubscriptionSnapshot,
  type VerifiedBillingEvent,
} from './gateway';

/**
 * The Stripe API version every request is made with.
 *
 * Pinned in code so behaviour does not change when the account's default
 * version does. It is typed against the SDK, so upgrading `stripe` to a
 * release built for a newer API fails type-check here until the version is
 * raised on purpose. Create the webhook endpoint with the same version: the
 * events it receives are shaped by the endpoint's version, not by this one.
 */
export const STRIPE_API_VERSION = '2026-09-30.endive' satisfies Stripe.LatestApiVersion;

/** Metadata key naming the user a customer or subscription belongs to. */
export const USER_METADATA_KEY = 'userId';

/** Webhook event types the API acts on. Subscribe the endpoint to exactly these. */
export const STRIPE_EVENT = {
  checkoutCompleted: 'checkout.session.completed',
  subscriptionCreated: 'customer.subscription.created',
  subscriptionUpdated: 'customer.subscription.updated',
  subscriptionDeleted: 'customer.subscription.deleted',
} as const;

export type StripeEventType = (typeof STRIPE_EVENT)[keyof typeof STRIPE_EVENT];

/** The event types to enable on the Stripe webhook endpoint. */
export const HANDLED_STRIPE_EVENTS: readonly StripeEventType[] = Object.values(STRIPE_EVENT);

const CHECKOUT_MODE_SUBSCRIPTION = 'subscription';
/** Stripe's error code for an id that names nothing. */
const RESOURCE_MISSING_CODE = 'resource_missing';
/** A customer has one subscription at a time here; the margin covers ended ones. */
const SUBSCRIPTION_LIST_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 10_000;
/** Network-level retries by the SDK, for connection errors and retryable statuses. */
const MAX_NETWORK_RETRIES = 2;
const MILLISECONDS_PER_SECOND = 1000;

function fromUnix(seconds: number): Date {
  return new Date(seconds * MILLISECONDS_PER_SECOND);
}

function idOf(reference: string | { id: string } | null): string | undefined {
  if (reference === null) return undefined;
  return typeof reference === 'string' ? reference : reference.id;
}

/** Reduce a Stripe subscription to the fields the API reads. */
export function toSubscriptionSnapshot(subscription: Stripe.Subscription): SubscriptionSnapshot | undefined {
  const item = subscription.items.data[0];
  if (!item) return undefined;

  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd: fromUnix(item.current_period_end),
    // Stripe records "do not renew" either as the flag or as an end date,
    // depending on how the cancellation was made. Both mean the same here.
    cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
    createdAt: fromUnix(subscription.created),
  };
}

/** Reduce a Stripe price to what the billing page shows. An archived price is no price. */
export function toPriceSnapshot(price: Stripe.Price): PriceSnapshot | undefined {
  if (!price.active || price.unit_amount === null) return undefined;
  return {
    id: price.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring ? { unit: price.recurring.interval, count: price.recurring.interval_count } : null,
  };
}

/** Reduce a verified Stripe event to what the webhook handler needs. */
export function toVerifiedEvent(event: Stripe.Event): VerifiedBillingEvent {
  switch (event.type) {
    case STRIPE_EVENT.subscriptionCreated:
    case STRIPE_EVENT.subscriptionUpdated:
    case STRIPE_EVENT.subscriptionDeleted: {
      const subscription = event.data.object;
      const customerId = idOf(subscription.customer);
      return {
        id: event.id,
        type: event.type,
        subscriptionChange: customerId
          ? { customerId, userId: subscription.metadata[USER_METADATA_KEY] }
          : undefined,
      };
    }
    case STRIPE_EVENT.checkoutCompleted: {
      const session = event.data.object;
      const customerId = idOf(session.customer);
      // Only subscription checkouts concern the subscription. One-time payments are not this handler's business.
      const isSubscription = session.mode === CHECKOUT_MODE_SUBSCRIPTION;
      return {
        id: event.id,
        type: event.type,
        subscriptionChange:
          isSubscription && customerId
            ? {
                customerId,
                userId: session.client_reference_id ?? session.metadata?.[USER_METADATA_KEY] ?? undefined,
              }
            : undefined,
      };
    }
    default:
      return { id: event.id, type: event.type, subscriptionChange: undefined };
  }
}

/**
 * Create the Stripe client with the pinned API version, a request timeout and
 * bounded retries.
 *
 * @param secretKey - The Stripe secret key.
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    timeout: REQUEST_TIMEOUT_MS,
    maxNetworkRetries: MAX_NETWORK_RETRIES,
  });
}

/**
 * Stripe-backed `BillingGateway`.
 *
 * @param stripe - Stripe client (see `createStripeClient`).
 * @param webhookSecret - Signing secret of the webhook endpoint.
 */
export function createStripeBillingGateway(stripe: Stripe, webhookSecret: string): BillingGateway {
  return {
    async createCustomer({ userId, email }: CreateCustomerInput) {
      const customer = await stripe.customers.create({
        ...(email ? { email } : {}),
        metadata: { [USER_METADATA_KEY]: userId },
      });
      return customer.id;
    },

    async listSubscriptions(customerId: string) {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: SUBSCRIPTION_LIST_LIMIT,
      });
      return page.data.map(toSubscriptionSnapshot).filter((snapshot) => snapshot !== undefined);
    },

    async findPrice(priceId: string) {
      try {
        return toPriceSnapshot(await stripe.prices.retrieve(priceId));
      } catch (err) {
        // A price id that names nothing is an answer, not an outage.
        if (err instanceof Stripe.errors.StripeError && err.code === RESOURCE_MISSING_CODE) return undefined;
        throw err;
      }
    },

    async createCheckoutSession(input: CreateCheckoutSessionInput) {
      const session = await stripe.checkout.sessions.create({
        mode: CHECKOUT_MODE_SUBSCRIPTION,
        customer: input.customerId,
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.userId,
        metadata: { [USER_METADATA_KEY]: input.userId },
        subscription_data: { metadata: { [USER_METADATA_KEY]: input.userId } },
      });
      if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
      return session.url;
    },

    async createPortalSession({ customerId, returnUrl }: CreatePortalSessionInput) {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
      return session.url;
    },

    async cancelSubscription(subscriptionId: string) {
      await stripe.subscriptions.cancel(subscriptionId);
    },

    verifyEvent(rawBody: Buffer, signature: string) {
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch {
        throw new InvalidWebhookSignatureError();
      }
      return toVerifiedEvent(event);
    },
  };
}
