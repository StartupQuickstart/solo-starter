/**
 * Account deletion against a real Postgres.
 *
 * A person deletes their account in Clerk (the account page), and Clerk sends
 * `user.deleted` to the webhook. That must end their Stripe subscription,
 * soft-delete the user and their notes together, clear the personal details
 * on the row, and leave everyone else alone.
 *
 * @module tests/integration/account-deletion.integration.test
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import type { PrismaClient } from '../../generated/prisma';
import { FAKE_PRICE, FakeBillingGateway, fakeSubscription } from '../../src/lib/billing/gateway.fake';
import { SUBSCRIPTION_STATUS } from '../../src/lib/billing/subscription';
import { authHeader, seedUser, truncateAll, type SeedUser } from './helpers/seed';
import { buildTestApp, TEST_APP_URL, TEST_PLAN_NAME } from './helpers/test-app';
import { connectToTestDatabase, DATABASE_URL_TEST } from './helpers/test-database';

const WEBHOOK_PATH = '/api/webhooks/clerk';
const CUSTOMER_ID = 'cus_leaving';
const DELETED_AT = new Date('2026-08-01T12:00:00.000Z');

describe.skipIf(!DATABASE_URL_TEST)('Account deletion: user.deleted', () => {
  let prisma: PrismaClient;
  let leaving: SeedUser;
  let staying: SeedUser;
  let gateway: FakeBillingGateway;
  let request: ReturnType<typeof supertest>;
  let deliveryCounter = 0;

  /** Builds the app. Pass `undefined` for a deployment with no Stripe keys. */
  const buildApp = (billingGateway: FakeBillingGateway | undefined) =>
    supertest(
      buildTestApp({
        prisma,
        knownUsers: [leaving, staying],
        overrides: {
          now: () => DELETED_AT,
          billing: {
            stripe: billingGateway ? { gateway: billingGateway, priceId: FAKE_PRICE.id } : undefined,
            planName: TEST_PLAN_NAME,
            appUrl: TEST_APP_URL,
          },
        },
      }),
    );

  /** Delivers `user.deleted` for a Clerk user. Each call is a new delivery unless an id is given. */
  const deliverDeleted = (clerkId: string, deliveryId?: string, app = request) => {
    deliveryCounter += 1;
    return app
      .post(WEBHOOK_PATH)
      .set('Content-Type', 'application/json')
      .set('svix-id', deliveryId ?? `msg_deleted_${deliveryCounter}`)
      .set('svix-timestamp', '1700000000')
      .set('svix-signature', 'v1,not-checked-here')
      .send(JSON.stringify({ type: 'user.deleted', data: { id: clerkId, deleted: true, object: 'user' }, object: 'event' }));
  };

  const storedUser = (user: SeedUser) => prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  // EXAMPLE: notes. This file checks that a deleted user takes their notes with them: check your own tables instead.
  const liveNotes = (user: SeedUser) => prisma.note.count({ where: { userId: user.id, deletedAt: null } });

  beforeAll(async () => {
    prisma = connectToTestDatabase();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    leaving = await seedUser(prisma, { stripeCustomerId: CUSTOMER_ID, subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE });
    staying = await seedUser(prisma, { stripeCustomerId: 'cus_staying', subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE });
    await prisma.user.update({
      where: { id: leaving.id },
      data: { firstName: 'Ada', lastName: 'Example', username: 'ada', imageUrl: 'https://example.com/ada.png' },
    });
    // EXAMPLE: notes. The rows each user owns before the deletion: create rows in your own table instead.
    await prisma.note.createMany({
      data: [
        { userId: leaving.id, title: 'Leaving one' },
        { userId: leaving.id, title: 'Leaving two' },
        { userId: staying.id, title: 'Staying' },
      ],
    });

    gateway = new FakeBillingGateway();
    gateway.setSubscriptions(CUSTOMER_ID, [fakeSubscription({ id: 'sub_leaving' })]);
    gateway.setSubscriptions('cus_staying', [fakeSubscription({ id: 'sub_staying' })]);
    request = buildApp(gateway);
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await prisma.$disconnect();
  });

  it('soft-deletes the user and their notes at the same moment, and clears their personal details', async () => {
    const res = await deliverDeleted(leaving.clerkId);

    expect(res.status).toBe(200);
    expect(await storedUser(leaving)).toMatchObject({
      deletedAt: DELETED_AT,
      clerkId: leaving.clerkId,
      email: null,
      firstName: null,
      lastName: null,
      username: null,
      imageUrl: null,
    });
    expect(await liveNotes(leaving)).toBe(0);
    // EXAMPLE: notes. Reads the example model: read your own.
    const notes = await prisma.note.findMany({ where: { userId: leaving.id } });
    expect(notes.map((note) => note.deletedAt)).toEqual([DELETED_AT, DELETED_AT]);
  });

  it('leaves every other user, their notes and their subscription alone', async () => {
    await deliverDeleted(leaving.clerkId);

    expect(await storedUser(staying)).toMatchObject({
      deletedAt: null,
      email: staying.email,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });
    expect(await liveNotes(staying)).toBe(1);
    expect(gateway.subscriptions.get('cus_staying')?.map((subscription) => subscription.status)).toEqual([
      SUBSCRIPTION_STATUS.ACTIVE,
    ]);
    // EXAMPLE: notes. The example's list route: use the list route of your own table.
    expect((await request.get('/api/v1/notes').set(authHeader(staying))).body.pagination.total).toBe(1);
  });

  it('ends the user’s Stripe subscription, so a deleted account is not billed again', async () => {
    await deliverDeleted(leaving.clerkId);

    expect(gateway.subscriptions.get(CUSTOMER_ID)?.map((subscription) => subscription.status)).toEqual([
      SUBSCRIPTION_STATUS.CANCELED,
    ]);
  });

  it('ends every subscription that has not ended, and leaves an ended one as it is', async () => {
    gateway.setSubscriptions(CUSTOMER_ID, [
      fakeSubscription({ id: 'sub_past_due', status: SUBSCRIPTION_STATUS.PAST_DUE }),
      fakeSubscription({ id: 'sub_paused', status: SUBSCRIPTION_STATUS.PAUSED }),
      fakeSubscription({ id: 'sub_expired', status: SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED }),
    ]);

    await deliverDeleted(leaving.clerkId);

    expect(gateway.subscriptions.get(CUSTOMER_ID)?.map((subscription) => subscription.status)).toEqual([
      SUBSCRIPTION_STATUS.CANCELED,
      SUBSCRIPTION_STATUS.CANCELED,
      SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
    ]);
  });

  it('deletes nothing when Stripe cannot be reached, answers 500, and finishes when Clerk retries', async () => {
    gateway.failure = new Error('Stripe is down');

    const failed = await deliverDeleted(leaving.clerkId, 'msg_retry');

    expect(failed.status).toBe(500);
    expect(await storedUser(leaving)).toMatchObject({ deletedAt: null, email: leaving.email });
    expect(await liveNotes(leaving)).toBe(2);

    gateway.failure = undefined;
    const retried = await deliverDeleted(leaving.clerkId, 'msg_retry');

    expect(retried.status).toBe(200);
    expect((await storedUser(leaving)).deletedAt).toEqual(DELETED_AT);
    expect(await liveNotes(leaving)).toBe(0);
    expect(gateway.subscriptions.get(CUSTOMER_ID)?.[0]?.status).toBe(SUBSCRIPTION_STATUS.CANCELED);
  });

  it('is idempotent: a second delivery for the same user changes nothing', async () => {
    await deliverDeleted(leaving.clerkId);
    await prisma.user.update({ where: { id: leaving.id }, data: { deletedAt: new Date('2026-01-01T00:00:00.000Z') } });

    const again = await deliverDeleted(leaving.clerkId);

    expect(again.status).toBe(200);
    expect((await storedUser(leaving)).deletedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('deletes the account without asking Stripe anything when billing is off', async () => {
    const res = await deliverDeleted(leaving.clerkId, undefined, buildApp(undefined));

    expect(res.status).toBe(200);
    expect((await storedUser(leaving)).deletedAt).toEqual(DELETED_AT);
    expect(gateway.subscriptions.get(CUSTOMER_ID)?.[0]?.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });

  it('deletes a user who never had a Stripe customer', async () => {
    const free = await seedUser(prisma);

    const res = await deliverDeleted(free.clerkId);

    expect(res.status).toBe(200);
    expect((await storedUser(free)).deletedAt).toEqual(DELETED_AT);
  });

  it('acknowledges a deletion for someone this database never saw', async () => {
    const res = await deliverDeleted('user_never_seen');

    expect(res.status).toBe(200);
    expect(await prisma.user.count({ where: { deletedAt: { not: null } } })).toBe(0);
  });

  it('no longer counts the deleted account as subscribed', async () => {
    await deliverDeleted(leaving.clerkId);

    // The stub still accepts the old token; the gate must not.
    // EXAMPLE: notes. The gated example route: use a route of yours that needs a subscription.
    const res = await request.get('/api/v1/notes/export').set(authHeader(leaving));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
  });
});
