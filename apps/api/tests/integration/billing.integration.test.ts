/**
 * Billing against a real Postgres, with the in-memory payment gateway.
 *
 * Covers the status endpoint, Checkout, the customer portal, and the webhook
 * that is the only writer of the subscription: de-duplication, late and
 * concurrent deliveries, failure and retry. It ends with the gated feature,
 * to show that what the billing page says and what the gate allows agree.
 *
 * @module tests/integration/billing.integration.test
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import type { PrismaClient } from '../../generated/prisma';
import type { VerifiedBillingEvent } from '../../src/lib/billing/gateway';
import {
  FAKE_PRICE,
  FAKE_VALID_SIGNATURE,
  FakeBillingGateway,
  fakeSubscription,
} from '../../src/lib/billing/gateway.fake';
import { SUBSCRIPTION_STATUS } from '../../src/lib/billing/subscription';
import { authHeader, seedUser, truncateAll, type SeedUser } from './helpers/seed';
import { buildTestApp, TEST_APP_URL, TEST_PLAN_NAME } from './helpers/test-app';
import { connectToTestDatabase, DATABASE_URL_TEST } from './helpers/test-database';

const BILLING = '/api/v1/billing';
const CHECKOUT = `${BILLING}/checkout`;
const PORTAL = `${BILLING}/portal`;
const WEBHOOK_PATH = '/api/webhooks/stripe';
// EXAMPLE: notes. The gated example route: point this at a route of yours that needs a subscription.
const EXPORT = '/api/v1/notes/export';
const CUSTOMER_ID = 'cus_existing';
const PERIOD_END = '2026-10-27T00:00:00.000Z';

describe.skipIf(!DATABASE_URL_TEST)('Billing', () => {
  let prisma: PrismaClient;
  let user: SeedUser;
  let bystander: SeedUser;
  let gateway: FakeBillingGateway;
  let request: ReturnType<typeof supertest>;
  let eventCounter = 0;

  const storedUser = (id: string = user.id) => prisma.user.findUniqueOrThrow({ where: { id } });

  /** Builds the app. Pass `undefined` for a deployment with no Stripe keys. */
  const buildApp = (billingGateway: FakeBillingGateway | undefined) =>
    supertest(
      buildTestApp({
        prisma,
        knownUsers: [user, bystander],
        overrides: {
          billing: {
            stripe: billingGateway ? { gateway: billingGateway, priceId: FAKE_PRICE.id } : undefined,
            planName: TEST_PLAN_NAME,
            appUrl: TEST_APP_URL,
          },
        },
      }),
    );

  /** A webhook event saying the customer's subscription may have changed. */
  const subscriptionEvent = (overrides: Partial<VerifiedBillingEvent> = {}): VerifiedBillingEvent => {
    eventCounter += 1;
    return {
      id: `evt_${eventCounter}`,
      type: 'customer.subscription.updated',
      subscriptionChange: { customerId: CUSTOMER_ID, userId: undefined },
      ...overrides,
    };
  };

  /** Delivers an event the way Stripe does: raw JSON body and a signature header. */
  const deliver = (event: VerifiedBillingEvent, signature: string = FAKE_VALID_SIGNATURE) =>
    request
      .post(WEBHOOK_PATH)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(JSON.stringify(event));

  /** Gives the user a Stripe customer, as a first Checkout would have. */
  const linkCustomer = () => prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: CUSTOMER_ID } });

  beforeAll(async () => {
    prisma = connectToTestDatabase();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    user = await seedUser(prisma);
    bystander = await seedUser(prisma);
    gateway = new FakeBillingGateway();
    request = buildApp(gateway);
  });

  afterEach(() => {
    gateway.failure = undefined;
    gateway.afterSnapshot = undefined;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  describe('GET /billing', () => {
    it('reports a user who never subscribed, with the plan’s name and price', async () => {
      const res = await request.get(BILLING).set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          billingEnabled: true,
          subscribed: false,
          status: null,
          plan: { name: 'Pro', priceLabel: '$9.00 / month' },
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
      });
    });

    it('reports billing off, nobody subscribed and no price when Stripe is not configured', async () => {
      const res = await buildApp(undefined).get(BILLING).set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        billingEnabled: false,
        subscribed: false,
        status: null,
        plan: { name: 'Pro', priceLabel: null },
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    });

    it('still answers, without a price, when Stripe is unreachable', async () => {
      gateway.failure = new Error('Stripe is down');

      const res = await request.get(BILLING).set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ billingEnabled: true, plan: { name: 'Pro', priceLabel: null } });
    });

    it('has no price when STRIPE_PRICE_ID names nothing in Stripe', async () => {
      gateway.prices = [];

      const res = await request.get(BILLING).set(authHeader(user));

      expect(res.body.data.plan).toEqual({ name: 'Pro', priceLabel: null });
    });

    it('asks Stripe for the price once, not on every request', async () => {
      await request.get(BILLING).set(authHeader(user));
      await request.get(BILLING).set(authHeader(user));
      await request.get(BILLING).set(authHeader(bystander));

      expect(gateway.priceLookups).toBe(1);
    });

    it('shows each user their own subscription and nobody else’s', async () => {
      await linkCustomer();
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);
      await deliver(subscriptionEvent());

      const mine = await request.get(BILLING).set(authHeader(user));
      const theirs = await request.get(BILLING).set(authHeader(bystander));

      expect(mine.body.data).toMatchObject({ subscribed: true, status: SUBSCRIPTION_STATUS.ACTIVE });
      expect(theirs.body.data).toMatchObject({ subscribed: false, status: null, currentPeriodEnd: null });
    });

    it('requires a session', async () => {
      const res = await request.get(BILLING);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------

  describe('POST /billing/checkout', () => {
    const checkout = (as: SeedUser = user) => request.post(CHECKOUT).set(authHeader(as)).send({});

    it('creates a customer for the user and returns a Checkout URL', async () => {
      const res = await checkout();

      expect(res.status).toBe(200);
      expect(res.body.data.url).toMatch(/^https:\/\/checkout\.example\.com\//);
      expect(gateway.customers).toEqual([{ id: 'cus_fake_1', userId: user.id, email: user.email }]);
      expect((await storedUser()).stripeCustomerId).toBe('cus_fake_1');
    });

    it('sells the configured price, names the user, and returns to the configured web origin', async () => {
      await checkout();

      expect(gateway.checkoutSessions).toEqual([
        {
          customerId: 'cus_fake_1',
          priceId: FAKE_PRICE.id,
          userId: user.id,
          successUrl: `${TEST_APP_URL}/billing?checkout=success`,
          cancelUrl: `${TEST_APP_URL}/billing?checkout=canceled`,
        },
      ]);
    });

    it('ignores a price, a customer or a return address sent by the client', async () => {
      await request.post(CHECKOUT).set(authHeader(user)).send({
        priceId: 'price_cheaper',
        customerId: 'cus_someone_else',
        userId: bystander.id,
        successUrl: 'https://attacker.example.com',
      });

      expect(gateway.checkoutSessions).toEqual([
        expect.objectContaining({
          priceId: FAKE_PRICE.id,
          customerId: 'cus_fake_1',
          userId: user.id,
          successUrl: `${TEST_APP_URL}/billing?checkout=success`,
        }),
      ]);
    });

    it('does not subscribe the user: only the webhook does', async () => {
      await checkout();

      expect(await storedUser()).toMatchObject({
        subscriptionStatus: null,
        stripeSubscriptionId: null,
        subscriptionCurrentPeriodEnd: null,
      });
    });

    it('reuses the user’s customer on a later Checkout', async () => {
      await checkout();
      await checkout();

      expect(gateway.customers).toHaveLength(1);
      expect(gateway.checkoutSessions.map((session) => session.customerId)).toEqual(['cus_fake_1', 'cus_fake_1']);
    });

    it('creates one customer when two Checkouts start at the same moment', async () => {
      const responses = await Promise.all([checkout(), checkout()]);

      expect(responses.map((res) => res.status)).toEqual([200, 200]);
      expect(gateway.customers).toHaveLength(1);
    });

    it('gives each user a customer of their own', async () => {
      await checkout(user);
      await checkout(bystander);

      expect(gateway.customers.map((customer) => customer.userId)).toEqual([user.id, bystander.id]);
      expect((await storedUser(bystander.id)).stripeCustomerId).toBe('cus_fake_2');
    });

    it('refuses a second subscription with 409 ALREADY_SUBSCRIBED and points to Manage billing', async () => {
      await linkCustomer();
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);

      const res = await checkout();

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'ALREADY_SUBSCRIBED' });
      expect(res.body.message).toMatch(/Manage billing/);
      expect(gateway.checkoutSessions).toEqual([]);
    });

    it('allows Checkout again after the previous subscription ended', async () => {
      await linkCustomer();
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ status: SUBSCRIPTION_STATUS.CANCELED })]);

      expect((await checkout()).status).toBe(200);
    });

    it('answers 503 BILLING_NOT_CONFIGURED when the price does not exist in Stripe', async () => {
      gateway.prices = [];

      const res = await checkout();

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ success: false, code: 'BILLING_NOT_CONFIGURED' });
      expect(gateway.checkoutSessions).toEqual([]);
    });

    it('answers 503 BILLING_NOT_CONFIGURED when Stripe is not configured', async () => {
      const res = await buildApp(undefined).post(CHECKOUT).set(authHeader(user)).send({});

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ success: false, code: 'BILLING_NOT_CONFIGURED' });
    });

    it('requires a session, and creates nothing without one', async () => {
      const res = await request.post(CHECKOUT).send({});

      expect(res.status).toBe(401);
      expect(gateway.customers).toEqual([]);
      expect(gateway.checkoutSessions).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Customer portal
  // ---------------------------------------------------------------------------

  describe('POST /billing/portal', () => {
    it('opens the portal for the user’s customer and returns to the billing page', async () => {
      await linkCustomer();

      const res = await request.post(PORTAL).set(authHeader(user)).send({});

      expect(res.status).toBe(200);
      expect(res.body.data.url).toMatch(/^https:\/\/portal\.example\.com\//);
      expect(gateway.portalSessions).toEqual([{ customerId: CUSTOMER_ID, returnUrl: `${TEST_APP_URL}/billing` }]);
    });

    it('answers 409 NO_CUSTOMER for a user who has never started a Checkout, and creates no customer', async () => {
      const res = await request.post(PORTAL).set(authHeader(user)).send({});

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'NO_CUSTOMER' });
      expect(gateway.customers).toEqual([]);
      expect(gateway.portalSessions).toEqual([]);
    });

    it('never opens another user’s portal, whatever customer the client names', async () => {
      await linkCustomer();

      const res = await request.post(PORTAL).set(authHeader(bystander)).send({ customerId: CUSTOMER_ID });

      expect(res.status).toBe(409);
      expect(gateway.portalSessions).toEqual([]);
    });

    it('answers 503 BILLING_NOT_CONFIGURED when Stripe is not configured', async () => {
      const res = await buildApp(undefined).post(PORTAL).set(authHeader(user)).send({});

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('BILLING_NOT_CONFIGURED');
    });

    it('requires a session', async () => {
      expect((await request.post(PORTAL).send({})).status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Webhook: the only writer of the subscription
  // ---------------------------------------------------------------------------

  describe('POST /webhooks/stripe', () => {
    beforeEach(async () => {
      await linkCustomer();
    });

    it('rejects a delivery with no signature header', async () => {
      const res = await request.post(WEBHOOK_PATH).set('Content-Type', 'application/json').send('{}');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/stripe-signature/);
    });

    it('rejects a bad signature and applies nothing', async () => {
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);

      const res = await deliver(subscriptionEvent(), 'forged-signature');

      expect(res.status).toBe(400);
      expect((await storedUser()).subscriptionStatus).toBeNull();
      expect(await prisma.stripeWebhookEvent.count()).toBe(0);
    });

    it('answers 503 when Stripe is not configured', async () => {
      const res = await buildApp(undefined)
        .post(WEBHOOK_PATH)
        .set('Content-Type', 'application/json')
        .set('stripe-signature', FAKE_VALID_SIGNATURE)
        .send('{}');

      expect(res.status).toBe(503);
    });

    it('subscribes the user when Checkout completes', async () => {
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ id: 'sub_new' })]);

      const res = await deliver(
        subscriptionEvent({
          type: 'checkout.session.completed',
          subscriptionChange: { customerId: CUSTOMER_ID, userId: user.id },
        }),
      );

      expect(res.status).toBe(200);
      expect(await storedUser()).toMatchObject({
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        stripeSubscriptionId: 'sub_new',
        subscriptionCurrentPeriodEnd: new Date(PERIOD_END),
        subscriptionCancelAtPeriodEnd: false,
      });
      expect((await storedUser(bystander.id)).subscriptionStatus).toBeNull();
    });

    it('then shows the subscription and its renewal date on the status endpoint', async () => {
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);
      await deliver(subscriptionEvent());

      const res = await request.get(BILLING).set(authHeader(user));

      expect(res.body.data).toEqual({
        billingEnabled: true,
        subscribed: true,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        plan: { name: 'Pro', priceLabel: '$9.00 / month' },
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
      });
    });

    it('keeps showing the stored subscription when Stripe is unreachable', async () => {
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);
      await deliver(subscriptionEvent());
      gateway.failure = new Error('Stripe is down');

      const res = await buildApp(gateway).get(BILLING).set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ subscribed: true, currentPeriodEnd: PERIOD_END });
    });

    it('records a cancellation that takes effect at the period end: still subscribed, set to end', async () => {
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);
      await deliver(subscriptionEvent());

      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ cancelAtPeriodEnd: true })]);
      await deliver(subscriptionEvent());

      const res = await request.get(BILLING).set(authHeader(user));
      expect(res.body.data).toMatchObject({
        subscribed: true,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: true,
      });
    });

    it.each([SUBSCRIPTION_STATUS.CANCELED, SUBSCRIPTION_STATUS.UNPAID])(
      'unsubscribes the user when the subscription becomes %s',
      async (status) => {
        gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ cancelAtPeriodEnd: true })]);
        await deliver(subscriptionEvent());

        gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ status, cancelAtPeriodEnd: true })]);
        await deliver(subscriptionEvent({ type: 'customer.subscription.deleted' }));

        expect(await storedUser()).toMatchObject({
          subscriptionStatus: status,
          subscriptionCurrentPeriodEnd: null,
          subscriptionCancelAtPeriodEnd: false,
        });
        const res = await request.get(BILLING).set(authHeader(user));
        expect(res.body.data).toMatchObject({ subscribed: false, status, currentPeriodEnd: null });
      },
    );

    it('keeps the user subscribed while a failed payment is retried (past due)', async () => {
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ status: SUBSCRIPTION_STATUS.PAST_DUE })]);

      await deliver(subscriptionEvent());

      const res = await request.get(BILLING).set(authHeader(user));
      expect(res.body.data).toMatchObject({ subscribed: true, status: SUBSCRIPTION_STATUS.PAST_DUE });
    });

    it('applies a redelivered event once', async () => {
      const event = subscriptionEvent();
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ id: 'sub_first' })]);
      const first = await deliver(event);

      // Stripe's state moves on, then the same event id arrives again.
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ id: 'sub_later' })]);
      const again = await deliver(event);

      expect(first.body.data).toEqual({ received: true });
      expect(again.status).toBe(200);
      expect(again.body.data).toEqual({ received: true, duplicate: true });
      expect((await storedUser()).stripeSubscriptionId).toBe('sub_first');
      expect(await prisma.stripeWebhookEvent.count({ where: { eventId: event.id } })).toBe(1);
    });

    it('cannot be regressed by an old event that arrives late', async () => {
      // The subscription was created, then canceled. Stripe delivers the
      // cancellation first and the creation event afterwards.
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ status: SUBSCRIPTION_STATUS.CANCELED })]);
      await deliver(subscriptionEvent({ type: 'customer.subscription.deleted' }));

      const late = await deliver(subscriptionEvent({ type: 'customer.subscription.created' }));

      expect(late.status).toBe(200);
      expect((await storedUser()).subscriptionStatus).toBe(SUBSCRIPTION_STATUS.CANCELED);
    });

    it('ends on the newest state when two deliveries are handled at the same moment', async () => {
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);

      // The first delivery has read "active" from Stripe. Before it writes, the
      // subscription is canceled and a second delivery starts.
      let second: PromiseLike<unknown> | undefined;
      gateway.afterSnapshot = async () => {
        gateway.afterSnapshot = undefined;
        gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ status: SUBSCRIPTION_STATUS.CANCELED })]);
        second = deliver(subscriptionEvent({ type: 'customer.subscription.deleted' })).then((res) => res);
        // Real time, on purpose: gives the second delivery the chance to
        // overtake the first, which it must not be able to do.
        await new Promise((resolve) => setTimeout(resolve, 200));
      };

      await deliver(subscriptionEvent());
      await second;

      // Without the per-user lock the first delivery would write its stale
      // "active" last and leave a canceled customer subscribed.
      expect((await storedUser()).subscriptionStatus).toBe(SUBSCRIPTION_STATUS.CANCELED);
    });

    it('records a failed attempt, answers 500, and applies the event when Stripe retries it', async () => {
      const event = subscriptionEvent();
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);
      gateway.failure = new Error('Stripe is down');

      const failed = await deliver(event);

      expect(failed.status).toBe(500);
      expect((await storedUser()).subscriptionStatus).toBeNull();
      expect(await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } })).toMatchObject({
        status: 'failed',
        error: 'Stripe is down',
      });

      gateway.failure = undefined;
      const retried = await deliver(event);

      expect(retried.status).toBe(200);
      expect((await storedUser()).subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
      expect(await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } })).toMatchObject({
        status: 'processed',
        error: null,
      });
    });

    it('acknowledges an event for a customer no user has, and subscribes nobody', async () => {
      gateway.setSubscriptions('cus_unknown', [fakeSubscription()]);

      const res = await deliver(subscriptionEvent({ subscriptionChange: { customerId: 'cus_unknown', userId: undefined } }));

      expect(res.status).toBe(200);
      expect(await prisma.user.count({ where: { subscriptionStatus: { not: null } } })).toBe(0);
    });

    it('acknowledges and records an event type it does not act on', async () => {
      const event = subscriptionEvent({ type: 'invoice.paid', subscriptionChange: undefined });

      const res = await deliver(event);

      expect(res.status).toBe(200);
      expect(await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } })).toMatchObject({
        eventType: 'invoice.paid',
        status: 'processed',
      });
    });

    it('links a user who has no customer when the subscription names them', async () => {
      gateway.setSubscriptions('cus_dashboard', [fakeSubscription()]);

      await deliver(subscriptionEvent({ subscriptionChange: { customerId: 'cus_dashboard', userId: bystander.id } }));

      expect(await storedUser(bystander.id)).toMatchObject({
        stripeCustomerId: 'cus_dashboard',
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      });
    });

    it('never moves a user who already has a customer onto another one', async () => {
      gateway.setSubscriptions('cus_attacker', [fakeSubscription()]);

      // A subscription on someone else's customer claims this user in its metadata.
      await deliver(subscriptionEvent({ subscriptionChange: { customerId: 'cus_attacker', userId: user.id } }));

      expect(await storedUser()).toMatchObject({ stripeCustomerId: CUSTOMER_ID, subscriptionStatus: null });
    });

    it('ignores an event for an account that was deleted, without asking Stripe to retry', async () => {
      await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);

      const res = await deliver(subscriptionEvent());

      expect(res.status).toBe(200);
      expect((await storedUser()).subscriptionStatus).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // The gate reads what the webhook wrote
  // ---------------------------------------------------------------------------

  describe('the gated feature', () => {
    it('opens when the webhook records a subscription and closes when it ends', async () => {
      await linkCustomer();
      expect((await request.get(EXPORT).set(authHeader(user))).status).toBe(403);

      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription()]);
      await deliver(subscriptionEvent());
      expect((await request.get(EXPORT).set(authHeader(user))).status).toBe(200);
      expect((await request.get(EXPORT).set(authHeader(bystander))).status).toBe(403);

      gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ status: SUBSCRIPTION_STATUS.CANCELED })]);
      await deliver(subscriptionEvent({ type: 'customer.subscription.deleted' }));
      expect((await request.get(EXPORT).set(authHeader(user))).status).toBe(403);
    });

    it('stays locked for everyone when Stripe is not configured', async () => {
      const res = await buildApp(undefined).get(EXPORT).set(authHeader(user));

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });
  });
});
