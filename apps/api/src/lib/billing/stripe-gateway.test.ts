import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';

import { InvalidWebhookSignatureError } from './gateway';
import {
  HANDLED_STRIPE_EVENTS,
  STRIPE_API_VERSION,
  createStripeBillingGateway,
  createStripeClient,
  toPriceSnapshot,
  toSubscriptionSnapshot,
  toVerifiedEvent,
} from './stripe-gateway';

// Offline only: no request leaves the process in this file. The client is
// used for its signature helpers, which need a key string but never send it.
const PLACEHOLDER_API_KEY = 'placeholder-key-for-offline-tests';
const WEBHOOK_SECRET = 'whsec_placeholder_for_offline_tests';

const PERIOD_END = 1_793_059_200; // 2026-10-27T00:00:00Z
const CREATED = 1_790_467_200; // 2026-09-27T00:00:00Z

function subscription(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_1',
    created: CREATED,
    cancel_at: null,
    cancel_at_period_end: false,
    metadata: { userId: 'usr_1' },
    items: { data: [{ current_period_end: PERIOD_END, price: { id: 'price_1' } }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function price(overrides: Record<string, unknown> = {}): Stripe.Price {
  return {
    id: 'price_1',
    object: 'price',
    active: true,
    unit_amount: 900,
    currency: 'usd',
    recurring: { interval: 'month', interval_count: 1 },
    ...overrides,
  } as unknown as Stripe.Price;
}

function event(type: string, object: unknown, id = 'evt_1'): Stripe.Event {
  return { id, object: 'event', type, data: { object } } as unknown as Stripe.Event;
}

describe('toSubscriptionSnapshot', () => {
  it('reads the status, the period and the creation time from a subscription', () => {
    expect(toSubscriptionSnapshot(subscription())).toEqual({
      id: 'sub_1',
      status: 'active',
      currentPeriodEnd: new Date('2026-10-27T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      createdAt: new Date('2026-09-27T00:00:00.000Z'),
    });
  });

  it('reports a subscription flagged to cancel at period end as ending', () => {
    expect(toSubscriptionSnapshot(subscription({ cancel_at_period_end: true }))?.cancelAtPeriodEnd).toBe(true);
  });

  it('reports a subscription with an end date as ending', () => {
    expect(toSubscriptionSnapshot(subscription({ cancel_at: PERIOD_END }))?.cancelAtPeriodEnd).toBe(true);
  });

  it('is undefined for a subscription with no items', () => {
    expect(toSubscriptionSnapshot(subscription({ items: { data: [] } }))).toBeUndefined();
  });
});

describe('toPriceSnapshot', () => {
  it('reads the amount, currency and billing interval of a recurring price', () => {
    expect(toPriceSnapshot(price())).toEqual({
      id: 'price_1',
      unitAmount: 900,
      currency: 'usd',
      interval: { unit: 'month', count: 1 },
    });
  });

  it('has no interval for a one-time price', () => {
    expect(toPriceSnapshot(price({ recurring: null }))?.interval).toBeNull();
  });

  it('is undefined for an archived price, and for one without a fixed amount', () => {
    expect(toPriceSnapshot(price({ active: false }))).toBeUndefined();
    expect(toPriceSnapshot(price({ unit_amount: null }))).toBeUndefined();
  });
});

describe('toVerifiedEvent', () => {
  it.each(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'])(
    'turns %s into a subscription change for the customer',
    (type) => {
      expect(toVerifiedEvent(event(type, subscription()))).toEqual({
        id: 'evt_1',
        type,
        subscriptionChange: { customerId: 'cus_1', userId: 'usr_1' },
      });
    },
  );

  it('reads the customer id from an expanded customer object', () => {
    const verified = toVerifiedEvent(event('customer.subscription.updated', subscription({ customer: { id: 'cus_2' } })));

    expect(verified.subscriptionChange?.customerId).toBe('cus_2');
  });

  it('turns a completed subscription checkout into a change, naming the user', () => {
    const session = { mode: 'subscription', customer: 'cus_1', client_reference_id: 'usr_9', metadata: {} };

    expect(toVerifiedEvent(event('checkout.session.completed', session))).toEqual({
      id: 'evt_1',
      type: 'checkout.session.completed',
      subscriptionChange: { customerId: 'cus_1', userId: 'usr_9' },
    });
  });

  it('falls back to the session metadata for the user', () => {
    const session = { mode: 'subscription', customer: 'cus_1', client_reference_id: null, metadata: { userId: 'usr_7' } };

    expect(toVerifiedEvent(event('checkout.session.completed', session)).subscriptionChange?.userId).toBe('usr_7');
  });

  it('ignores a completed checkout that is not a subscription', () => {
    const session = { mode: 'payment', customer: 'cus_1', client_reference_id: 'usr_9', metadata: {} };

    expect(toVerifiedEvent(event('checkout.session.completed', session)).subscriptionChange).toBeUndefined();
  });

  it('carries no change for an event type the API does not act on', () => {
    expect(toVerifiedEvent(event('invoice.paid', { id: 'in_1' }))).toEqual({
      id: 'evt_1',
      type: 'invoice.paid',
      subscriptionChange: undefined,
    });
  });
});

describe('createStripeBillingGateway.verifyEvent', () => {
  const stripe = createStripeClient(PLACEHOLDER_API_KEY);
  const gateway = createStripeBillingGateway(stripe, WEBHOOK_SECRET);
  const payload = JSON.stringify(event('customer.subscription.updated', subscription(), 'evt_signed'));

  it('accepts a body signed with the endpoint secret', () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

    const verified = gateway.verifyEvent(Buffer.from(payload), signature);

    expect(verified.id).toBe('evt_signed');
    expect(verified.subscriptionChange).toEqual({ customerId: 'cus_1', userId: 'usr_1' });
  });

  it('rejects a body signed with another secret', () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_some_other_secret' });

    expect(() => gateway.verifyEvent(Buffer.from(payload), signature)).toThrow(InvalidWebhookSignatureError);
  });

  it('rejects a body changed after it was signed', () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const tampered = payload.replace('cus_1', 'cus_attacker');

    expect(() => gateway.verifyEvent(Buffer.from(tampered), signature)).toThrow(InvalidWebhookSignatureError);
  });

  it('rejects a signature older than the tolerance', () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
      timestamp: tenMinutesAgo,
    });

    expect(() => gateway.verifyEvent(Buffer.from(payload), signature)).toThrow(InvalidWebhookSignatureError);
  });
});

describe('Stripe configuration', () => {
  it('pins the API version on the client', () => {
    expect(createStripeClient(PLACEHOLDER_API_KEY).getApiField('version')).toBe(STRIPE_API_VERSION);
  });

  it('handles checkout completion alongside the three subscription events', () => {
    expect([...HANDLED_STRIPE_EVENTS].sort()).toEqual([
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.deleted',
      'customer.subscription.updated',
    ]);
  });
});
