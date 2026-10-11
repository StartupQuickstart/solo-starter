import type { PrismaClient, User } from '../../../../generated/prisma';
import type { BillingGateway, SubscriptionSnapshot } from '@/lib/billing/gateway';
import { isSubscribed, SUBSCRIPTION_STATUS } from '@/lib/billing/subscription';
import {
  AlreadySubscribedError,
  NoCustomerError,
  PriceUnavailableError,
  UserNotFoundError,
} from './billing.errors';

/** Where the browser lands after Checkout or the customer portal. */
export interface BillingReturnUrls {
  /** After a completed Checkout. */
  readonly checkoutSuccess: string;
  /** After backing out of Checkout. */
  readonly checkoutCancel: string;
  /** After leaving the customer portal. */
  readonly portalReturn: string;
}

/** The billing page of the web client, with the outcome of a Checkout as a query flag. */
export const BILLING_PAGE_PATH = '/billing';
export const CHECKOUT_RESULT_PARAM = 'checkout';
export const CHECKOUT_RESULT = { success: 'success', canceled: 'canceled' } as const;

/**
 * Build the return URLs from the web client's configured origin. They are
 * never derived from a request, so a caller cannot redirect a customer to
 * another site through Stripe.
 *
 * @param appUrl - Origin of the web client (`APP_URL`).
 */
export function billingReturnUrls(appUrl: string): BillingReturnUrls {
  const billingPage = `${appUrl}${BILLING_PAGE_PATH}`;
  return {
    checkoutSuccess: `${billingPage}?${CHECKOUT_RESULT_PARAM}=${CHECKOUT_RESULT.success}`,
    checkoutCancel: `${billingPage}?${CHECKOUT_RESULT_PARAM}=${CHECKOUT_RESULT.canceled}`,
    portalReturn: billingPage,
  };
}

/** What billing needs from Stripe: the gateway and the one price it sells. */
export interface StripeBilling {
  readonly gateway: BillingGateway;
  /** `STRIPE_PRICE_ID`. */
  readonly priceId: string;
}

/** What the billing routes and the Stripe webhook need. Built at the composition root. */
export interface BillingDeps {
  /** `undefined` when Stripe is not configured: billing is then off. */
  readonly stripe: StripeBilling | undefined;
  /** Display name of the one plan (`BILLING_PLAN_NAME`). */
  readonly planName: string;
  /** Origin of the web client; Stripe returns the browser here. */
  readonly appUrl: string;
}

/** How long work under the user lock may take: one Stripe request with its retries. */
const LOCKED_WORK_TIMEOUT_MS = 30_000;
/** How long to wait for a database connection before starting. */
const LOCK_WAIT_TIMEOUT_MS = 10_000;

/** Statuses of a subscription that is over; there is nothing left to cancel. */
const ENDED_STATUSES: ReadonlySet<string> = new Set([
  SUBSCRIPTION_STATUS.CANCELED,
  SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
]);

/** What a customer's subscriptions amount to for the user: the columns the webhook writes. */
export interface SubscriptionState {
  readonly subscriptionStatus: string | null;
  readonly stripeSubscriptionId: string | null;
  /** End of the current billing period; `null` unless subscribed. */
  readonly subscriptionCurrentPeriodEnd: Date | null;
  /** Whether the subscription is set to end instead of renewing. */
  readonly subscriptionCancelAtPeriodEnd: boolean;
}

function newestFirst(a: SubscriptionSnapshot, b: SubscriptionSnapshot): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/**
 * Decide a user's subscription state from everything Stripe holds for their
 * customer.
 *
 * Pure. The subscription that counts is the newest one in a subscribed status
 * (see `isSubscribed`). With none, the user is not subscribed, and the status
 * shown is that of their most recent subscription (for example `canceled`).
 *
 * The kit this starter is cut from also maps the subscription's price to one
 * of several plans here. With one plan, any live subscription of the customer
 * counts, whatever its price: changing STRIPE_PRICE_ID later does not lock out
 * the people who subscribed at the old price.
 *
 * @param subscriptions - Every subscription of the customer, any status.
 */
export function resolveSubscriptionState(subscriptions: readonly SubscriptionSnapshot[]): SubscriptionState {
  const ordered = [...subscriptions].sort(newestFirst);
  const live = ordered.find((subscription) => isSubscribed(subscription.status));

  if (!live) {
    const latest = ordered[0];
    return {
      subscriptionStatus: latest?.status ?? null,
      stripeSubscriptionId: latest?.id ?? null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionCancelAtPeriodEnd: false,
    };
  }

  return {
    subscriptionStatus: live.status,
    stripeSubscriptionId: live.id,
    subscriptionCurrentPeriodEnd: live.currentPeriodEnd,
    subscriptionCancelAtPeriodEnd: live.cancelAtPeriodEnd,
  };
}

/**
 * Billing logic. The user is the billing entity: one Stripe customer, one
 * subscription, one plan.
 *
 * Prisma and the gateway are injected; tests use a real database and the
 * in-memory gateway.
 */
export class BillingService {
  /**
   * @param prisma - Prisma client.
   * @param gateway - The payment provider.
   * @param urls - Where Stripe returns the browser.
   * @param priceId - The price of the one plan (`STRIPE_PRICE_ID`).
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateway: BillingGateway,
    private readonly urls: BillingReturnUrls,
    private readonly priceId: string,
  ) {}

  /**
   * Run `work` while holding a row lock on the user.
   *
   * Everything that reads Stripe and then writes billing columns goes through
   * here, so two of them for the same user run one after the other. The read
   * happens after the lock is taken, which is what makes the later writer the
   * one with the newer picture.
   */
  private async withUserLock<T>(
    userId: string,
    work: (user: User, tx: Pick<PrismaClient, 'user'>) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM app.users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null } });
        if (!user) throw new UserNotFoundError();
        return work(user, tx);
      },
      // The lock is held across one Stripe request, so the transaction must
      // outlive that request's timeout. Billing writes are rare; correctness
      // matters more here than holding a connection for a few seconds.
      { timeout: LOCKED_WORK_TIMEOUT_MS, maxWait: LOCK_WAIT_TIMEOUT_MS },
    );
  }

  /**
   * The user's Stripe customer, created on first use with their email and
   * their user id as metadata. Concurrent first uses create one customer, not
   * two.
   */
  private async ensureCustomer(userId: string): Promise<string> {
    return this.withUserLock(userId, async (user, tx) => {
      if (user.stripeCustomerId) return user.stripeCustomerId;

      const customerId = await this.gateway.createCustomer({ userId: user.id, email: user.email ?? undefined });
      await tx.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
      return customerId;
    });
  }

  /**
   * Start a hosted Checkout for the plan.
   *
   * Refuses when the user already has a subscription: a second Checkout would
   * create a second subscription and bill twice. Changing or cancelling is
   * done in the customer portal.
   *
   * This does not make the user a subscriber. That happens when Stripe's
   * webhook reports the subscription.
   *
   * @param userId - The user buying the plan.
   * @returns The Checkout URL to send the browser to.
   * @throws AlreadySubscribedError, PriceUnavailableError, UserNotFoundError
   */
  async createCheckoutSession(userId: string): Promise<string> {
    const customerId = await this.ensureCustomer(userId);

    // Ask Stripe, not the database: a subscription whose webhook has not
    // arrived yet must still block a second purchase.
    const subscriptions = await this.gateway.listSubscriptions(customerId);
    if (subscriptions.some((subscription) => isSubscribed(subscription.status))) {
      throw new AlreadySubscribedError();
    }

    const price = await this.gateway.findPrice(this.priceId);
    if (!price) throw new PriceUnavailableError();

    return this.gateway.createCheckoutSession({
      customerId,
      priceId: price.id,
      userId,
      successUrl: this.urls.checkoutSuccess,
      cancelUrl: this.urls.checkoutCancel,
    });
  }

  /**
   * Start a hosted customer portal session, where the user updates the
   * payment method, downloads invoices or cancels.
   *
   * @param userId - The user whose billing is managed.
   * @returns The portal URL to send the browser to.
   * @throws NoCustomerError when the user has never started a Checkout.
   */
  async createPortalSession(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { stripeCustomerId: true },
    });
    if (!user) throw new UserNotFoundError();
    if (!user.stripeCustomerId) throw new NoCustomerError();

    return this.gateway.createPortalSession({ customerId: user.stripeCustomerId, returnUrl: this.urls.portalReturn });
  }

  /**
   * Bring a user's subscription columns in line with what Stripe holds for
   * their customer. THE ONLY CODE THAT WRITES THEM; called by the webhook.
   *
   * It ignores the event that triggered it and reads the customer's
   * subscriptions from Stripe, under a lock on the user. That makes it safe
   * against everything a webhook stream does:
   *  - a duplicate delivery writes the same state again
   *  - an old event delivered late reads today's state, so it cannot put an
   *    old subscription back
   *  - two deliveries at once run one after the other
   *
   * @param customerId - The Stripe customer the event is about.
   * @param userHint - A user named on the session or subscription. Used only
   *   when no user has this customer yet (a subscription created by hand in
   *   the Stripe dashboard), and only for a user that has no customer of
   *   their own, so metadata can never move a user off their existing billing.
   * @returns The state written, or `undefined` when no user matches.
   */
  async syncFromStripe(customerId: string, userHint?: string): Promise<SubscriptionState | undefined> {
    const userId = await this.findUserFor(customerId, userHint);
    if (!userId) return undefined;

    try {
      return await this.applyStripeState(userId, customerId);
    } catch (error) {
      // The account was deleted. There is nothing to update, and failing
      // would make Stripe retry the event for days.
      if (error instanceof UserNotFoundError) return undefined;
      throw error;
    }
  }

  /**
   * End every subscription of a customer that has not ended already. Called
   * when the user deletes their account: nobody could reach the customer
   * portal afterwards, so a subscription left running would bill forever.
   *
   * Reads the subscriptions from Stripe first, so a second call (a retried
   * webhook delivery) finds nothing left to cancel.
   *
   * @param customerId - The Stripe customer of the deleted account.
   */
  async cancelSubscriptions(customerId: string): Promise<void> {
    const subscriptions = await this.gateway.listSubscriptions(customerId);
    for (const subscription of subscriptions) {
      if (!ENDED_STATUSES.has(subscription.status)) await this.gateway.cancelSubscription(subscription.id);
    }
  }

  private applyStripeState(userId: string, customerId: string): Promise<SubscriptionState | undefined> {
    return this.withUserLock(userId, async (user, tx) => {
      // Re-checked under the lock: the user may have been linked to a
      // different customer since the lookup.
      if (user.stripeCustomerId !== null && user.stripeCustomerId !== customerId) return undefined;

      const state = resolveSubscriptionState(await this.gateway.listSubscriptions(customerId));

      await tx.user.update({ where: { id: user.id }, data: { ...state, stripeCustomerId: customerId } });
      return state;
    });
  }

  private async findUserFor(customerId: string, userHint: string | undefined): Promise<string | undefined> {
    const owner = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (owner) return owner.id;
    if (!userHint) return undefined;

    const unbilled = await this.prisma.user.findFirst({
      where: { id: userHint, stripeCustomerId: null, deletedAt: null },
      select: { id: true },
    });
    return unbilled?.id;
  }
}

/**
 * The billing service for these dependencies, or `undefined` when billing is off.
 *
 * @param prisma - The application Prisma client
 * @param deps - The gateway, the price and the web client's origin
 */
export function createBillingService(prisma: PrismaClient, deps: BillingDeps): BillingService | undefined {
  if (!deps.stripe) return undefined;
  return new BillingService(prisma, deps.stripe.gateway, billingReturnUrls(deps.appUrl), deps.stripe.priceId);
}
