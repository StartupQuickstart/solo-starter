import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '../../../../../generated/prisma';
import { sendData, sendError } from '@/api/envelope';
import { createBillingService, type BillingDeps } from '@/api/v1/billing/billing.service';
import { InvalidWebhookSignatureError, type VerifiedBillingEvent } from '@/lib/billing/gateway';

/** Header Stripe signs each delivery with. */
const SIGNATURE_HEADER = 'stripe-signature';

/** Outcome recorded for a delivery in `stripe_webhook_events`. */
const WEBHOOK_EVENT_STATUS = {
  processed: 'processed',
  failed: 'failed',
} as const;

/**
 * Create the Stripe webhook router.
 *
 * **MUST be mounted BEFORE `requireAuth`**: this endpoint is authenticated by
 * the Stripe signature over the raw body, not by a session. `src/index.ts`
 * mounts `express.raw()` at this path before the global `express.json()`, so
 * `req.body` here is a Buffer.
 *
 * It handles `checkout.session.completed` and
 * `customer.subscription.created | updated | deleted`. Each means "this
 * customer's subscription may have changed" and nothing more: the handler
 * then reads the customer's subscriptions from Stripe and writes the result
 * (`BillingService.syncFromStripe`). This is the only place the user's
 * subscription columns are written.
 *
 * What makes that safe:
 *  - De-duplication. An event id already recorded as processed is
 *    acknowledged without being applied again.
 *  - Ordering. Stripe does not deliver events in order, and says not to order
 *    them by `created`. Because the handler reads current state instead of
 *    applying the event's snapshot, an old event delivered late cannot put an
 *    old subscription back.
 *  - Failure. A failed attempt is recorded and answered 500, so Stripe
 *    retries it. A retry of a failed event is processed again.
 *
 * @param prisma - Application Prisma client
 * @param deps - The payment gateway and price (absent when billing is off) and the web client's origin
 * @returns Express Router for `POST /` (mount at `/api/webhooks/stripe`)
 */
export function createStripeWebhookRouter(prisma: PrismaClient, deps: BillingDeps): Router {
  const router = Router();
  const service = createBillingService(prisma, deps);

  router.post('/', async (req: Request, res: Response) => {
    if (!deps.stripe || !service) {
      sendError(res, 503, 'Billing is not set up');
      return;
    }

    const signature = req.headers[SIGNATURE_HEADER];
    if (typeof signature !== 'string') {
      sendError(res, 400, 'Missing stripe-signature header');
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      // Indicates the raw-body middleware was not mounted before this handler.
      // Without the original bytes, signature verification is impossible.
      sendError(res, 500, 'Raw body not available; webhook route misconfigured');
      return;
    }

    let event: VerifiedBillingEvent;
    try {
      event = deps.stripe.gateway.verifyEvent(req.body, signature);
    } catch (err) {
      if (!(err instanceof InvalidWebhookSignatureError)) throw err;
      sendError(res, 400, 'Invalid signature');
      return;
    }

    const existing = await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing?.status === WEBHOOK_EVENT_STATUS.processed) {
      sendData(res, { received: true, duplicate: true });
      return;
    }

    try {
      if (event.subscriptionChange) {
        await service.syncFromStripe(event.subscriptionChange.customerId, event.subscriptionChange.userId);
      }
      // An event type this handler does not act on is still recorded and
      // acknowledged, so Stripe does not retry it.

      await prisma.stripeWebhookEvent.upsert({
        where: { eventId: event.id },
        create: { eventId: event.id, eventType: event.type, status: WEBHOOK_EVENT_STATUS.processed },
        update: { status: WEBHOOK_EVENT_STATUS.processed, error: null, processedAt: new Date() },
      });
      sendData(res, { received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      // The log line carries the error's class only: its message can hold
      // request details. The message is kept with the event's row.
      console.error('[StripeWebhook] Handler error', {
        eventId: event.id,
        eventType: event.type,
        error: err instanceof Error ? err.name : 'UnknownError',
      });
      await prisma.stripeWebhookEvent.upsert({
        where: { eventId: event.id },
        create: { eventId: event.id, eventType: event.type, status: WEBHOOK_EVENT_STATUS.failed, error: message },
        update: { status: WEBHOOK_EVENT_STATUS.failed, error: message, processedAt: new Date() },
      });
      // 500: Stripe retries. Processing is idempotent, so a retry is safe.
      sendError(res, 500, 'Error processing webhook');
    }
  });

  return router;
}
