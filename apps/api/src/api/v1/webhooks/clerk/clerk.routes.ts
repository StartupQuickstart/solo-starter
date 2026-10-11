import { verifyWebhook } from '@clerk/express/webhooks';
import { Router, Request, Response } from 'express';
import { sendData, sendError } from '@/api/envelope';
import type { PrismaClient } from '../../../../../generated/prisma';
import {
  clerkUserDeletedSchema,
  clerkUserEventSchema,
  handleUserCreated,
  handleUserDeleted,
  handleUserUpdated,
} from './clerk-sync.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The parts of a verified Clerk webhook event this route reads. */
export interface ClerkWebhookEvent {
  readonly type: string;
  readonly data: object;
}

/**
 * Verifies a webhook request's signature and returns its event.
 * Rejects when the signature is missing, wrong or too old.
 */
export type ClerkWebhookVerifier = (req: Request) => Promise<ClerkWebhookEvent>;

export interface ClerkWebhookOptions {
  /** Signing secret of the endpoint in the Clerk dashboard (`CLERK_WEBHOOK_SIGNING_SECRET`). */
  readonly signingSecret: string | undefined;
  /** Signature check. Defaults to Clerk's `verifyWebhook`; tests inject a fake. */
  readonly verify?: ClerkWebhookVerifier;
  /** Ends the Stripe subscriptions of a deleted account's customer. Left out when billing is off. */
  readonly cancelSubscriptions?: ((customerId: string) => Promise<void>) | undefined;
  /** The clock; tests fix it. */
  readonly now?: (() => Date) | undefined;
}

/** The Clerk events this route acts on. Subscribe the endpoint to exactly these. */
export const CLERK_EVENT = {
  userCreated: 'user.created',
  userUpdated: 'user.updated',
  userDeleted: 'user.deleted',
} as const;

/** Outcome recorded for a delivery in `clerk_webhook_events`. */
const WEBHOOK_EVENT_STATUS = {
  processed: 'processed',
  failed: 'failed',
} as const;

/** Header carrying the delivery's unique id; the same id is sent again on a retry. */
const DELIVERY_ID_HEADER = 'svix-id';

const UNKNOWN_OBJECT_ID = 'unknown';

/** Clerk's own verifier, bound to this deployment's signing secret. */
function createClerkVerifier(signingSecret: string): ClerkWebhookVerifier {
  return (req) => verifyWebhook(req, { signingSecret });
}

function objectIdOf(event: ClerkWebhookEvent): string {
  const id: unknown = 'id' in event.data ? event.data.id : undefined;
  return typeof id === 'string' ? id : UNKNOWN_OBJECT_ID;
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

/**
 * Create the Clerk webhook router.
 *
 * **MUST be mounted BEFORE `requireAuth()`**: this endpoint is authenticated
 * by the webhook signature (verified with Clerk's `verifyWebhook`), not a
 * Clerk session token.
 *
 * Handles `user.created`, `user.updated` and `user.deleted`.
 *
 * Idempotency: each delivery is deduplicated by its id, stored in the
 * `clerk_webhook_events` table. Only a record with the status `processed`
 * short-circuits as a duplicate. A `failed` record (or none at all) falls
 * through to processing, so a failed attempt is retried on Clerk's next
 * delivery instead of being swallowed.
 *
 * @param prisma - Application Prisma client
 * @param options - The signing secret, and optionally a replacement verifier
 * @returns Express Router for `POST /` (mount at `/api/webhooks/clerk`)
 */
export function createClerkWebhookRouter(prisma: PrismaClient, options: ClerkWebhookOptions): Router {
  const router = Router();
  const verify = options.verify ?? (options.signingSecret ? createClerkVerifier(options.signingSecret) : undefined);
  const now = options.now ?? (() => new Date());

  /**
   * One handler per event type; each parses the event's data before using it.
   * A Map, so an event type sent by a caller can only ever name one of these.
   */
  const handlers = new Map<string, (data: object) => Promise<void>>([
    [CLERK_EVENT.userCreated, (data) => handleUserCreated(prisma, clerkUserEventSchema.parse(data))],
    [CLERK_EVENT.userUpdated, (data) => handleUserUpdated(prisma, clerkUserEventSchema.parse(data))],
    [
      CLERK_EVENT.userDeleted,
      (data) =>
        handleUserDeleted(prisma, clerkUserDeletedSchema.parse(data), {
          now: now(),
          cancelSubscriptions: options.cancelSubscriptions,
        }),
    ],
  ]);

  // Signature verification requires the exact raw bytes Clerk sent.
  // src/index.ts mounts express.raw() at this path BEFORE the global
  // express.json() runs, so req.body here is a Buffer.
  router.post('/', async (req: Request, res: Response) => {
    if (!verify) {
      sendError(res, 500, 'Webhook secret not configured');
      return;
    }

    const eventId = req.headers[DELIVERY_ID_HEADER];
    if (typeof eventId !== 'string' || eventId === '') {
      sendError(res, 400, 'Missing webhook signature headers');
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      // Indicates the raw-body middleware was not mounted before this handler.
      // Without the original bytes, signature verification is impossible.
      sendError(res, 500, 'Raw body not available; webhook route misconfigured');
      return;
    }

    let event: ClerkWebhookEvent;
    try {
      event = await verify(req);
    } catch {
      sendError(res, 400, 'Invalid signature');
      return;
    }

    const objectId = objectIdOf(event);

    // Only a successfully processed event is a duplicate. An earlier failed
    // record must not block reprocessing on Clerk's retry.
    const existing = await prisma.clerkWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existing?.status === WEBHOOK_EVENT_STATUS.processed) {
      sendData(res, { received: true, message: 'Already processed' });
      return;
    }

    try {
      // An event type with no handler is still recorded and acknowledged, so
      // Clerk does not retry it.
      await handlers.get(event.type)?.(event.data);

      // Upsert (not create) because an earlier failed attempt for this same
      // delivery may already have a row.
      await prisma.clerkWebhookEvent.upsert({
        where: { eventId },
        create: {
          eventType: event.type,
          eventId,
          objectId,
          payload: event.data,
          status: WEBHOOK_EVENT_STATUS.processed,
        },
        update: {
          payload: event.data,
          status: WEBHOOK_EVENT_STATUS.processed,
          error: null,
          processedAt: new Date(),
        },
      });

      sendData(res, { received: true });
    } catch (err) {
      // Record failure and return non-2xx so Clerk retries the delivery.
      await prisma.clerkWebhookEvent.upsert({
        where: { eventId },
        create: {
          eventType: event.type,
          eventId,
          objectId,
          payload: event.data,
          status: WEBHOOK_EVENT_STATUS.failed,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        update: {
          payload: event.data,
          status: WEBHOOK_EVENT_STATUS.failed,
          error: err instanceof Error ? err.message : 'Unknown error',
          processedAt: new Date(),
        },
      });

      sendError(res, 500, 'Error processing webhook');
    }
  });

  return router;
}
