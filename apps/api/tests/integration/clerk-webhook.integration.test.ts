/**
 * The Clerk webhook against a real Postgres: `user.created` and
 * `user.updated` copy a person's details into the users table, each delivery
 * is applied once, and a failed delivery is retried.
 *
 * Signature checks are covered in src/api/v1/webhooks/clerk/clerk.routes.test.ts;
 * here the event is the request body. `user.deleted` has its own file,
 * account-deletion.integration.test.ts.
 *
 * @module tests/integration/clerk-webhook.integration.test
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import type { PrismaClient } from '../../generated/prisma';
import { truncateAll } from './helpers/seed';
import { buildTestApp } from './helpers/test-app';
import { connectToTestDatabase, DATABASE_URL_TEST } from './helpers/test-database';

const WEBHOOK_PATH = '/api/webhooks/clerk';
const CLERK_ID = 'user_clerk_ada';

const USER_DATA = {
  id: CLERK_ID,
  email_addresses: [
    { id: 'em_old', email_address: 'old@example.com' },
    { id: 'em_primary', email_address: 'ada@example.com' },
  ],
  primary_email_address_id: 'em_primary',
  first_name: 'Ada',
  last_name: 'Example',
  username: 'ada',
  image_url: 'https://example.com/ada.png',
  last_sign_in_at: null,
};

describe.skipIf(!DATABASE_URL_TEST)('Clerk webhook: user sync', () => {
  let prisma: PrismaClient;
  let request: ReturnType<typeof supertest>;
  let deliveryCounter = 0;

  /** Delivers an event the way Clerk does. Each call is a new delivery unless an id is given. */
  const deliver = (type: string, data: object, deliveryId?: string) => {
    deliveryCounter += 1;
    return request
      .post(WEBHOOK_PATH)
      .set('Content-Type', 'application/json')
      .set('svix-id', deliveryId ?? `msg_${deliveryCounter}`)
      .set('svix-timestamp', '1700000000')
      .set('svix-signature', 'v1,not-checked-here')
      .send(JSON.stringify({ type, data, object: 'event' }));
  };

  const storedUser = () => prisma.user.findUnique({ where: { clerkId: CLERK_ID } });

  beforeAll(async () => {
    prisma = connectToTestDatabase();
    request = supertest(buildTestApp({ prisma, knownUsers: [] }));
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await prisma.$disconnect();
  });

  describe('user.created', () => {
    it('creates the user with their primary email', async () => {
      const res = await deliver('user.created', USER_DATA);

      expect(res.status).toBe(200);
      expect(await storedUser()).toMatchObject({
        id: expect.stringMatching(/^usr_/),
        clerkId: CLERK_ID,
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Example',
        username: 'ada',
        imageUrl: 'https://example.com/ada.png',
        deletedAt: null,
        subscriptionStatus: null,
      });
    });

    it('updates the row instead of failing when the first request already created it', async () => {
      const provisioned = await prisma.user.create({ data: { clerkId: CLERK_ID, email: 'ada@example.com' } });

      const res = await deliver('user.created', USER_DATA);

      expect(res.status).toBe(200);
      expect(await prisma.user.count()).toBe(1);
      expect(await storedUser()).toMatchObject({ id: provisioned.id, firstName: 'Ada', username: 'ada' });
    });

    it('creates a user who has no email address yet', async () => {
      await deliver('user.created', { ...USER_DATA, email_addresses: [], primary_email_address_id: null });

      expect(await storedUser()).toMatchObject({ clerkId: CLERK_ID, email: null });
    });
  });

  describe('user.updated', () => {
    it('copies changed details onto the existing row and keeps its billing', async () => {
      await deliver('user.created', USER_DATA);
      await prisma.user.update({
        where: { clerkId: CLERK_ID },
        data: { stripeCustomerId: 'cus_ada', subscriptionStatus: 'active' },
      });

      const res = await deliver('user.updated', {
        ...USER_DATA,
        first_name: 'Augusta',
        primary_email_address_id: 'em_old',
        image_url: null,
        last_sign_in_at: 1_790_467_200_000,
      });

      expect(res.status).toBe(200);
      expect(await storedUser()).toMatchObject({
        email: 'old@example.com',
        firstName: 'Augusta',
        imageUrl: null,
        lastSignInAt: new Date('2026-09-27T00:00:00.000Z'),
        stripeCustomerId: 'cus_ada',
        subscriptionStatus: 'active',
      });
    });

    it('keeps the known email when the event carries no primary address', async () => {
      await deliver('user.created', USER_DATA);

      await deliver('user.updated', { ...USER_DATA, primary_email_address_id: null });

      expect((await storedUser())?.email).toBe('ada@example.com');
    });

    it('creates the user when user.created never arrived', async () => {
      const res = await deliver('user.updated', USER_DATA);

      expect(res.status).toBe(200);
      expect(await storedUser()).toMatchObject({ clerkId: CLERK_ID, email: 'ada@example.com' });
    });

    it('does not write details back onto an account that was deleted, when it arrives late', async () => {
      await deliver('user.created', USER_DATA);
      await deliver('user.deleted', { id: CLERK_ID, deleted: true });

      const late = await deliver('user.updated', { ...USER_DATA, first_name: 'Returned' });

      expect(late.status).toBe(200);
      expect(await storedUser()).toMatchObject({ email: null, firstName: null, deletedAt: expect.any(Date) });
    });
  });

  describe('deliveries', () => {
    it('applies a redelivered event once', async () => {
      await deliver('user.created', USER_DATA, 'msg_same');
      await prisma.user.update({ where: { clerkId: CLERK_ID }, data: { firstName: 'Changed since' } });

      const again = await deliver('user.created', USER_DATA, 'msg_same');

      expect(again.status).toBe(200);
      expect(again.body.data).toEqual({ received: true, message: 'Already processed' });
      expect((await storedUser())?.firstName).toBe('Changed since');
      expect(await prisma.clerkWebhookEvent.count({ where: { eventId: 'msg_same' } })).toBe(1);
    });

    it('records a failed attempt as failed, answers 500, and applies the delivery when it is retried', async () => {
      // First attempt: data that is not a user, so the handler refuses it. (A
      // real retry repeats the same body; the bad one stands in for whatever
      // made the first attempt fail.)
      const failed = await deliver('user.created', { email_addresses: 'not-a-list' }, 'msg_retry');

      expect(failed.status).toBe(500);
      expect(await prisma.clerkWebhookEvent.findUnique({ where: { eventId: 'msg_retry' } })).toMatchObject({
        status: 'failed',
        eventType: 'user.created',
      });
      expect(await prisma.user.count()).toBe(0);

      const retried = await deliver('user.created', USER_DATA, 'msg_retry');

      expect(retried.status).toBe(200);
      expect(await prisma.clerkWebhookEvent.findUnique({ where: { eventId: 'msg_retry' } })).toMatchObject({
        status: 'processed',
        error: null,
      });
      expect(await storedUser()).not.toBeNull();
    });

    it('acknowledges and records an event type it does not act on, and creates nothing', async () => {
      const res = await deliver('session.created', { id: 'sess_1' }, 'msg_other');

      expect(res.status).toBe(200);
      expect(await prisma.clerkWebhookEvent.findUnique({ where: { eventId: 'msg_other' } })).toMatchObject({
        eventType: 'session.created',
        status: 'processed',
      });
      expect(await prisma.user.count()).toBe(0);
    });
  });
});
