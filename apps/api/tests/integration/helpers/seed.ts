/**
 * Seed helpers for integration tests.
 *
 * They insert minimal rows into the test database. Callers own cleanup
 * (`truncateAll`).
 *
 * @module tests/integration/helpers/seed
 */

import { randomUUID } from 'crypto';
import type { PrismaClient } from '../../../generated/prisma';
import type { SubscriptionStatus } from '../../../src/lib/billing/subscription';
import { mintTestToken } from './stub-auth';

/** A seeded user with a signed test token. */
export interface SeedUser {
  readonly id: string;
  readonly email: string;
  readonly clerkId: string;
  /** Pass as `Authorization: Bearer <token>`. */
  readonly token: string;
}

export interface SeedUserOptions {
  /** A subscription status, as the Stripe webhook would have written it. Omit for a user who never subscribed. */
  readonly subscriptionStatus?: SubscriptionStatus;
  /** The user's Stripe customer, as a first Checkout would have left it. */
  readonly stripeCustomerId?: string;
}

/**
 * Seed a user.
 *
 * @param prisma - Connected test Prisma client
 * @param options - Billing state to start from
 * @returns The user's identifiers and a signed test token
 */
export async function seedUser(prisma: PrismaClient, options: SeedUserOptions = {}): Promise<SeedUser> {
  const suffix = randomUUID();

  const user = await prisma.user.create({
    data: {
      email: `test+${suffix}@example.com`,
      clerkId: `clerk_user_${suffix}`,
      ...(options.subscriptionStatus ? { subscriptionStatus: options.subscriptionStatus } : {}),
      ...(options.stripeCustomerId ? { stripeCustomerId: options.stripeCustomerId } : {}),
    },
  });

  return {
    id: user.id,
    email: `test+${suffix}@example.com`,
    clerkId: user.clerkId,
    token: mintTestToken(user.id, user.clerkId),
  };
}

/** The `Authorization` header that signs a request as `user`. */
export function authHeader(user: SeedUser): { Authorization: string } {
  return { Authorization: `Bearer ${user.token}` };
}

/**
 * Empty every table. Used before and after suites to reset the database.
 *
 * @param prisma - Connected test Prisma client
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  // EXAMPLE: notes. The `app.notes` line below empties the example table; list your own tables there.
  await prisma.$executeRaw`
    TRUNCATE TABLE
      app.clerk_webhook_events,
      app.stripe_webhook_events,
      app.notes,
      app.users
    CASCADE
  `;
}
