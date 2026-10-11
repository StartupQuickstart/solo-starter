import { getAuthenticatedUser } from '@app/backend';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PrismaClient } from '../../../generated/prisma';

import { ErrorCodes, sendError } from '@/api/envelope';
import { isSubscribed } from '@/lib/billing/subscription';

/** Reads the subscription status stored for a user. */
export type SubscriptionStatusReader = (userId: string) => Promise<string | null>;

/** Shown to a user who is not subscribed. */
export const SUBSCRIPTION_REQUIRED_MESSAGE = 'This needs a subscription.';

/**
 * The status stored for the user: the value the Stripe webhook wrote. A
 * deleted or unknown user reads as never subscribed.
 */
export function createStoredSubscriptionReader(prisma: PrismaClient): SubscriptionStatusReader {
  return async (userId) => {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { subscriptionStatus: true },
    });
    return user?.subscriptionStatus ?? null;
  };
}

/**
 * Build `requireSubscription`: route middleware that lets a request through
 * only when the signed-in user is subscribed (see `isSubscribed`).
 *
 * Mount it on a route behind `requireAuth`. It answers 403
 * `SUBSCRIPTION_REQUIRED`, so the client can show an upgrade prompt instead of
 * a generic error. Without Stripe nobody is subscribed and the route stays
 * locked.
 *
 * @example
 * const requireSubscription = createRequireSubscription(createStoredSubscriptionReader(prisma));
 * router.get('/export', requireSubscription, (req, res) => controller.exportCsv(req, res));
 *
 * @param readStatus - How to read a user's subscription status.
 */
export function createRequireSubscription(readStatus: SubscriptionStatusReader): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = getAuthenticatedUser(req);

    if (!isSubscribed(await readStatus(userId))) {
      sendError(res, 403, SUBSCRIPTION_REQUIRED_MESSAGE, { code: ErrorCodes.SUBSCRIPTION_REQUIRED });
      return;
    }
    next();
  };
}
