import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../../generated/prisma';
import { createBillingRouter } from './billing/billing.routes';
import { createBillingService, type BillingDeps } from './billing/billing.service';
import { createHealthRouter } from './health.routes';
// EXAMPLE: notes. This import.
import { createNotesRouter } from './notes/notes.routes';
import { createClerkWebhookRouter, type ClerkWebhookOptions } from './webhooks/clerk/clerk.routes';
import { createStripeWebhookRouter } from './webhooks/stripe/stripe.routes';

/** Paths of the routes that answer without a session. Signature-verified where noted. */
export const PUBLIC_PATHS = {
  /** Authenticated by the Clerk webhook signature. */
  clerkWebhook: '/api/webhooks/clerk',
  /** Authenticated by the Stripe webhook signature. */
  stripeWebhook: '/api/webhooks/stripe',
} as const;

/** Everything the v1 router needs. Built at the composition root (`src/index.ts`). */
export interface V1RouterDeps {
  readonly prisma: PrismaClient;
  /** Answers 401 unless a user is signed in. Everything mounted after it is protected. */
  readonly requireAuth: RequestHandler;
  /** The Clerk webhook's signing secret, and optionally a replacement verifier. */
  readonly clerkWebhook: Pick<ClerkWebhookOptions, 'signingSecret' | 'verify'>;
  /** The payment gateway and price (absent when billing is off), the plan's name and the web client's origin. */
  readonly billing: BillingDeps;
  /** The clock, for everything that stamps a time. Defaults to the system clock; tests fix it. */
  readonly now?: () => Date;
}

/**
 * Create the v1 API router.
 *
 * Mount order is the access-control model, so it is fixed here and nowhere
 * else:
 *
 *  1. Public routes: the health check and the two signed webhooks.
 *  2. `requireAuth`. Every route mounted after this line needs a session.
 *  3. Features, at `/api/v1/<feature>`. Each works on the signed-in user's
 *     own rows: "signed in, and the row is yours" is the whole access rule.
 *
 * A route mounted above step 2 is public. `tests/integration/route-inventory.test.ts`
 * walks this router and fails when a route exists that the inventory does not
 * list, so a new route cannot become public (or exist at all) unnoticed.
 *
 * @param deps - Injected collaborators; tests pass stubs for auth and Clerk.
 * @returns A Router containing every v1 endpoint.
 */
export function createV1Router(deps: V1RouterDeps): Router {
  const { prisma, requireAuth, clerkWebhook, billing, now } = deps;
  const billingService = createBillingService(prisma, billing);
  const router = Router();

  // ---------------------------------------------------------------------------
  // 1. Public routes
  // ---------------------------------------------------------------------------

  /** GET /api/v1/health and /health. */
  router.use(createHealthRouter());

  /** POST /api/webhooks/clerk. Raw body is mounted for this path in src/index.ts. */
  router.use(
    PUBLIC_PATHS.clerkWebhook,
    createClerkWebhookRouter(prisma, {
      ...clerkWebhook,
      now,
      // Deleting an account ends its subscription. Without billing there is none.
      cancelSubscriptions: billingService
        ? (customerId) => billingService.cancelSubscriptions(customerId)
        : undefined,
    }),
  );

  /** POST /api/webhooks/stripe. Raw body is mounted for this path in src/index.ts. */
  router.use(PUBLIC_PATHS.stripeWebhook, createStripeWebhookRouter(prisma, billing));

  // ---------------------------------------------------------------------------
  // 2. Everything below requires a session
  // ---------------------------------------------------------------------------

  router.use(requireAuth);

  // ---------------------------------------------------------------------------
  // 3. Features: /api/v1/<feature>, each scoped to the signed-in user
  // ---------------------------------------------------------------------------

  // The example feature, and the pattern to copy.
  // EXAMPLE: notes. The line that mounts the example; mount your own feature the same way.
  router.use('/api/v1/notes', createNotesRouter(prisma, now));
  router.use('/api/v1/billing', createBillingRouter(prisma, billing));
  // Extension point: your product's features mount here. Gate a paid one with
  // createRequireSubscription (src/api/middleware/require-subscription.ts).

  return router;
}
