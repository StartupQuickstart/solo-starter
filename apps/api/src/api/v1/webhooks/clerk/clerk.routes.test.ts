import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import type { PrismaClient } from '../../../../../generated/prisma';
import crypto from 'crypto';
import { createClerkWebhookRouter, type ClerkWebhookOptions, type ClerkWebhookVerifier } from './clerk.routes';

// ---------------------------------------------------------------------------
// This file tests the route: signatures, de-duplication and dispatch. What
// the handlers do to the database is tested against a real one in
// tests/integration/clerk-webhook.integration.test.ts.
//
// Signature verification is injected, so most tests use a fake verifier and
// need no real signatures. The last block signs requests for real.
// ---------------------------------------------------------------------------

const verify = vi.fn<ClerkWebhookVerifier>();

/** A syntactically valid signing secret (`whsec_` + base64). Not a real one. */
const TEST_SIGNING_SECRET = `whsec_${Buffer.from('unit-test-signing-key-0123456789').toString('base64')}`;

const WEBHOOK_PATH = '/api/webhooks/clerk';
const FIXED_NOW = new Date('2026-08-01T12:00:00.000Z');

vi.mock('./clerk-sync.service', async (importOriginal) => ({
  // The payload schemas are the real ones: the route parses with them.
  ...(await importOriginal<typeof import('./clerk-sync.service')>()),
  handleUserCreated: vi.fn().mockResolvedValue(undefined),
  handleUserUpdated: vi.fn().mockResolvedValue(undefined),
  handleUserDeleted: vi.fn().mockResolvedValue(undefined),
}));

import { handleUserCreated, handleUserUpdated, handleUserDeleted } from './clerk-sync.service';

/** The de-duplication table only: the handlers are replaced above. */
function makeFakePrisma(): PrismaClient {
  return {
    clerkWebhookEvent: {
      findUnique: vi.fn().mockResolvedValue(null), // default: not already processed
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

function buildTestApp(
  prisma: PrismaClient,
  options: ClerkWebhookOptions = { signingSecret: TEST_SIGNING_SECRET, verify, now: () => FIXED_NOW },
) {
  const app = express();
  // Mirror production: raw body parser for the webhook path (the signature
  // covers the original bytes), then JSON parser for everything else.
  app.use(WEBHOOK_PATH, express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use(WEBHOOK_PATH, createClerkWebhookRouter(prisma, options));
  return app;
}

const USER_PAYLOAD = {
  type: 'user.created',
  data: {
    id: 'clerk_user_1',
    email_addresses: [{ id: 'em_1', email_address: 'alice@example.com' }],
    primary_email_address_id: 'em_1',
    first_name: 'Alice',
    last_name: 'Smith',
    username: 'alice',
    image_url: null,
    last_sign_in_at: null,
  },
  object: 'event',
};

// Signature headers (fake: verification is injected)
const SVIX_HEADERS = {
  'svix-id': 'msg_test_123',
  'svix-timestamp': String(Math.floor(Date.now() / 1000)),
  'svix-signature': 'v1,fake_signature',
};

function mockVerifySuccess(payload: { type: string; data: object }) {
  verify.mockResolvedValue(payload);
}

function mockVerifyFailure() {
  verify.mockRejectedValue(new Error('Invalid signature'));
}

/** Signs a body the way Clerk does (Standard Webhooks: HMAC-SHA256 over `id.timestamp.body`). */
function signedHeaders(body: string, secret: string, id = 'msg_signed_1'): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(secret.replace('whsec_', ''), 'base64');
  const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` };
}

describe('createClerkWebhookRouter', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof buildTestApp>;

  const deliver = (payload: object, target = app) => supertest(target).post(WEBHOOK_PATH).set(SVIX_HEADERS).send(payload);

  beforeEach(() => {
    vi.clearAllMocks();
    verify.mockReset();
    vi.mocked(handleUserCreated).mockResolvedValue(undefined);
    prisma = makeFakePrisma();
    app = buildTestApp(prisma);
  });

  describe('signature validation', () => {
    it('refuses every delivery, and changes nothing, while no signing secret is configured', async () => {
      const res = await deliver(USER_PAYLOAD, buildTestApp(prisma, { signingSecret: undefined }));

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/secret not configured/i);
      expect(prisma.clerkWebhookEvent.findUnique).not.toHaveBeenCalled();
      expect(prisma.clerkWebhookEvent.upsert).not.toHaveBeenCalled();
      expect(handleUserCreated).not.toHaveBeenCalled();
    });

    it('returns 400 when the signature headers are missing', async () => {
      const res = await supertest(app).post(WEBHOOK_PATH).send(USER_PAYLOAD);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/signature headers/i);
      expect(verify).not.toHaveBeenCalled();
    });

    it('returns 400, and runs no handler, when signature verification fails', async () => {
      mockVerifyFailure();

      const res = await deliver(USER_PAYLOAD);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/signature/i);
      expect(handleUserCreated).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('acknowledges a delivery that was already processed without running it again', async () => {
      mockVerifySuccess(USER_PAYLOAD);
      vi.mocked(prisma.clerkWebhookEvent.findUnique).mockResolvedValue({ id: 'existing', status: 'processed' } as never);

      const res = await deliver(USER_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toMatch(/already processed/i);
      expect(handleUserCreated).not.toHaveBeenCalled();
    });

    it('processes a delivery again when the earlier attempt failed', async () => {
      mockVerifySuccess(USER_PAYLOAD);
      vi.mocked(prisma.clerkWebhookEvent.findUnique).mockResolvedValue({ id: 'existing', status: 'failed' } as never);

      const res = await deliver(USER_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBeUndefined();
      expect(handleUserCreated).toHaveBeenCalledWith(prisma, USER_PAYLOAD.data);
      expect(prisma.clerkWebhookEvent.upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { eventId: 'msg_test_123' },
          update: expect.objectContaining({ status: 'processed' }),
        }),
      );
    });
  });

  describe('dispatch', () => {
    it('runs handleUserCreated for user.created and records the delivery', async () => {
      mockVerifySuccess(USER_PAYLOAD);

      const res = await deliver(USER_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);
      expect(handleUserCreated).toHaveBeenCalledWith(prisma, USER_PAYLOAD.data);
      expect(prisma.clerkWebhookEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ eventType: 'user.created', objectId: 'clerk_user_1', status: 'processed' }),
        }),
      );
    });

    it('runs handleUserUpdated for user.updated', async () => {
      const payload = { ...USER_PAYLOAD, type: 'user.updated' };
      mockVerifySuccess(payload);

      await deliver(payload);

      expect(handleUserUpdated).toHaveBeenCalledWith(prisma, payload.data);
    });

    it('runs handleUserDeleted for user.deleted, with the clock’s reading', async () => {
      const payload = { type: 'user.deleted', data: { id: 'clerk_user_1', deleted: true }, object: 'event' };
      mockVerifySuccess(payload);

      await deliver(payload);

      expect(handleUserDeleted).toHaveBeenCalledWith(
        prisma,
        { id: 'clerk_user_1' },
        { now: FIXED_NOW, cancelSubscriptions: undefined },
      );
    });

    it('hands handleUserDeleted the way to end subscriptions when billing is on', async () => {
      const cancelSubscriptions = vi.fn();
      const payload = { type: 'user.deleted', data: { id: 'clerk_user_1' }, object: 'event' };
      mockVerifySuccess(payload);

      await deliver(payload, buildTestApp(prisma, { signingSecret: TEST_SIGNING_SECRET, verify, cancelSubscriptions }));

      expect(handleUserDeleted).toHaveBeenCalledWith(
        prisma,
        { id: 'clerk_user_1' },
        expect.objectContaining({ cancelSubscriptions }),
      );
    });

    it.each(['email.created', 'session.created', 'constructor', '__proto__'])(
      'acknowledges %s, which it does not act on, and runs no handler',
      async (type) => {
        mockVerifySuccess({ type, data: { id: 'anything' } });

        const res = await deliver({ type, data: { id: 'anything' } });

        expect(res.status).toBe(200);
        expect(handleUserCreated).not.toHaveBeenCalled();
        expect(handleUserUpdated).not.toHaveBeenCalled();
        expect(handleUserDeleted).not.toHaveBeenCalled();
      },
    );
  });

  describe('error handling', () => {
    it('answers 500 and records the failure when a handler throws, so Clerk retries', async () => {
      mockVerifySuccess(USER_PAYLOAD);
      vi.mocked(handleUserCreated).mockRejectedValue(new Error('DB error'));

      const res = await deliver(USER_PAYLOAD);

      expect(res.status).toBe(500);
      expect(prisma.clerkWebhookEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ status: 'failed' }) }),
      );
    });

    it('answers 500, and runs no handler, for a user event whose data is not a user', async () => {
      const malformed = { type: 'user.created', data: { email_addresses: 'not-a-list' } };
      mockVerifySuccess(malformed);

      const res = await deliver(malformed);

      expect(res.status).toBe(500);
      expect(handleUserCreated).not.toHaveBeenCalled();
    });
  });

  describe('with Clerk’s verifyWebhook and a real signature', () => {
    const body = JSON.stringify(USER_PAYLOAD);

    const deliverSigned = (sent: string, secret: string) =>
      supertest(buildTestApp(prisma, { signingSecret: TEST_SIGNING_SECRET }))
        .post(WEBHOOK_PATH)
        .set('Content-Type', 'application/json')
        .set(signedHeaders(body, secret))
        .send(sent);

    it('accepts a request signed with the configured secret', async () => {
      const res = await deliverSigned(body, TEST_SIGNING_SECRET);

      expect(res.status).toBe(200);
      expect(handleUserCreated).toHaveBeenCalledWith(prisma, USER_PAYLOAD.data);
    });

    it('rejects a request signed with another secret', async () => {
      const otherSecret = `whsec_${Buffer.from('a-different-signing-key-98765432').toString('base64')}`;

      const res = await deliverSigned(body, otherSecret);

      expect(res.status).toBe(400);
      expect(handleUserCreated).not.toHaveBeenCalled();
    });

    it('rejects a body that was changed after it was signed', async () => {
      const res = await deliverSigned(body.replace('alice@example.com', 'mallory@example.com'), TEST_SIGNING_SECRET);

      expect(res.status).toBe(400);
      expect(handleUserCreated).not.toHaveBeenCalled();
    });
  });
});
