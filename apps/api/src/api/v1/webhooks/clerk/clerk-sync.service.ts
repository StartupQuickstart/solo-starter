import { z } from 'zod';

import type { PrismaClient } from '../../../../../generated/prisma';

// ---------------------------------------------------------------------------
// Clerk webhook payloads
// ---------------------------------------------------------------------------

/**
 * The fields of Clerk's `user.created` / `user.updated` data this API copies.
 * Field names are Clerk's snake_case convention.
 */
export const clerkUserEventSchema = z.object({
  id: z.string().min(1),
  email_addresses: z.array(z.object({ id: z.string(), email_address: z.string() })).default([]),
  primary_email_address_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  username: z.string().nullish(),
  image_url: z.string().nullish(),
  /** Milliseconds since the epoch. */
  last_sign_in_at: z.number().nullish(),
});

export type ClerkUserEventData = z.infer<typeof clerkUserEventSchema>;

/** Clerk's `user.deleted` data. Clerk may leave the id out; there is then nobody to delete. */
export const clerkUserDeletedSchema = z.object({ id: z.string().min(1).optional() });

export type ClerkUserDeletedData = z.infer<typeof clerkUserDeletedSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPrimaryEmail(data: ClerkUserEventData): string | null {
  if (!data.primary_email_address_id) return null;
  const found = data.email_addresses.find((address) => address.id === data.primary_email_address_id);
  return found?.email_address ?? null;
}

/**
 * Whether this Clerk user's account was already deleted here. Clerk does not
 * deliver events in order, so a `user.updated` can arrive after the
 * `user.deleted` it preceded; it must not write personal details back onto
 * the deleted row.
 */
async function wasDeleted(prisma: PrismaClient, clerkId: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({ where: { clerkId }, select: { deletedAt: true } });
  return existing?.deletedAt != null;
}

// ---------------------------------------------------------------------------
// User handlers
// ---------------------------------------------------------------------------

/**
 * Handle `user.created`: upsert the User row.
 *
 * Upsert, not create: the API provisions the user on their first request,
 * which usually beats this webhook, and Clerk retries deliveries. A plain
 * create would fail on the unique clerk_id and retry forever.
 *
 * @param prisma - Prisma client
 * @param data - Clerk user event payload
 */
export async function handleUserCreated(prisma: PrismaClient, data: ClerkUserEventData): Promise<void> {
  if (await wasDeleted(prisma, data.id)) return;

  const fields = {
    email: getPrimaryEmail(data),
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    username: data.username ?? null,
    imageUrl: data.image_url ?? null,
  };
  await prisma.user.upsert({
    where: { clerkId: data.id },
    create: { clerkId: data.id, ...fields },
    // Keep a known email rather than overwrite it with a missing one.
    update: { ...fields, email: fields.email ?? undefined },
  });
}

/**
 * Handle `user.updated`: upsert the User row (Clerk delivers at least once
 * and in no particular order, so `user.created` may not have arrived).
 *
 * @param prisma - Prisma client
 * @param data - Clerk user event payload
 */
export async function handleUserUpdated(prisma: PrismaClient, data: ClerkUserEventData): Promise<void> {
  if (await wasDeleted(prisma, data.id)) return;

  const email = getPrimaryEmail(data);
  const lastSignInAt = data.last_sign_in_at != null ? new Date(data.last_sign_in_at) : undefined;
  const fields = {
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    username: data.username ?? null,
    imageUrl: data.image_url ?? null,
  };

  await prisma.user.upsert({
    where: { clerkId: data.id },
    create: { clerkId: data.id, email, ...fields, lastSignInAt: lastSignInAt ?? null },
    update: { email: email ?? undefined, ...fields, ...(lastSignInAt !== undefined ? { lastSignInAt } : {}) },
  });
}

/** What deleting an account needs besides the database. */
export interface UserDeletionDeps {
  /** The clock's reading: the deletion time of the user and of their notes. */
  readonly now: Date;
  /**
   * Ends every Stripe subscription of a customer. Left out when billing is
   * off. Nobody can reach the customer portal after the account is gone, so a
   * subscription left running would bill forever.
   */
  readonly cancelSubscriptions?: ((customerId: string) => Promise<void>) | undefined;
}

/**
 * Handle `user.deleted`: the person deleted their account in Clerk.
 *
 *  1. Their Stripe subscription is ended. This comes first: if Stripe cannot
 *     be reached the handler fails, nothing here has changed, and Clerk
 *     delivers the event again.
 *  2. The user and their notes are soft-deleted in one transaction, and the
 *     personal details on the user row are cleared.
 *
 * Idempotent: a second delivery finds no live user and does nothing.
 *
 * @param prisma - Prisma client
 * @param data - Clerk user deleted payload
 * @param deps - The clock and, when billing is on, how to end subscriptions
 */
export async function handleUserDeleted(
  prisma: PrismaClient,
  data: ClerkUserDeletedData,
  deps: UserDeletionDeps,
): Promise<void> {
  if (!data.id) return;
  const user = await prisma.user.findFirst({
    where: { clerkId: data.id, deletedAt: null },
    select: { id: true, stripeCustomerId: true },
  });
  if (!user) return;

  if (user.stripeCustomerId && deps.cancelSubscriptions) {
    await deps.cancelSubscriptions(user.stripeCustomerId);
  }

  await prisma.$transaction([
    // EXAMPLE: notes. A deleted user takes their rows with them: do the same for each table of yours that a user owns.
    prisma.note.updateMany({ where: { userId: user.id, deletedAt: null }, data: { deletedAt: deps.now } }),
    prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: deps.now, email: null, firstName: null, lastName: null, username: null, imageUrl: null },
    }),
  ]);
}
