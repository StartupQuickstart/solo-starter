import { Router } from 'express';
import type { PrismaClient } from '../../../../generated/prisma';
import { rateLimitByUser } from '@/api/middleware/rate-limit';
import { BillingController } from './billing.controller';
import { billingErrorHandler } from './billing.errors';
import type { BillingDeps } from './billing.service';

/** Starting a Stripe-hosted session creates objects in Stripe; a person needs a handful, not hundreds. */
const HOSTED_SESSION_RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 } as const;

/**
 * Create the billing router. Mounted behind `requireAuth`; everything here is
 * about the signed-in user's own subscription.
 *
 *   GET  /billing           subscription status, plan name and price, renewal date
 *   POST /billing/checkout  start Stripe Checkout for the plan, answers { url }
 *   POST /billing/portal    open the Stripe customer portal, answers { url }
 *
 * None of these writes the subscription. It is written only by the Stripe
 * webhook (`/api/webhooks/stripe`).
 *
 * @param prisma - The application Prisma client
 * @param deps - The payment gateway and price (absent when billing is off), the plan's name and the web client's origin
 * @returns Express Router with billing routes
 */
export function createBillingRouter(prisma: PrismaClient, deps: BillingDeps): Router {
  const controller = new BillingController(prisma, deps);
  const router = Router();

  router.get('/', (req, res) => controller.status(req, res));
  router.post('/checkout', rateLimitByUser(HOSTED_SESSION_RATE_LIMIT), (req, res) => controller.checkout(req, res));
  router.post('/portal', rateLimitByUser(HOSTED_SESSION_RATE_LIMIT), (req, res) => controller.portal(req, res));
  router.use(billingErrorHandler);

  return router;
}
