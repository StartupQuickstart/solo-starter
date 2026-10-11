import { getAuthenticatedUser } from '@app/backend';
import type { Request, Response } from 'express';
import type { PrismaClient } from '../../../../generated/prisma';
import { sendData } from '@/api/envelope';
import { formatPriceLabel } from '@/lib/billing/price-label';
import { isSubscribed } from '@/lib/billing/subscription';
import { BillingNotConfiguredError, UserNotFoundError } from './billing.errors';
import { createBillingService, type BillingDeps, type BillingService } from './billing.service';

/** Payload of `GET /billing`. */
interface BillingResponse {
  /** `false` when Stripe is not configured: nothing can be bought and nobody is subscribed. */
  readonly billingEnabled: boolean;
  /** The answer `isSubscribed` gives for the stored status: what the gated feature checks. */
  readonly subscribed: boolean;
  /** Stripe's subscription status as stored by the webhook, or `null` when the user never subscribed. */
  readonly status: string | null;
  readonly plan: {
    readonly name: string;
    /** For example "$9.00 / month". `null` when billing is off or Stripe cannot be asked. */
    readonly priceLabel: string | null;
  };
  /** End of the current billing period (ISO 8601), or `null` without a subscription. */
  readonly currentPeriodEnd: string | null;
  /** Whether the subscription is set to end at `currentPeriodEnd` instead of renewing. */
  readonly cancelAtPeriodEnd: boolean;
}

/**
 * HTTP controller for billing: the user's subscription, and the two hosted
 * Stripe pages (Checkout and the customer portal).
 *
 * None of these handlers changes whether the user is subscribed. Checkout and
 * the portal hand the browser to Stripe; the subscription columns change when
 * Stripe's webhook arrives.
 *
 * Handler conventions:
 *  1. `getAuthenticatedUser(req)` at the top; it throws AuthenticationError (401).
 *  2. Failures are thrown as billing domain errors (`billing.errors.ts`) and
 *     mapped to responses by `billingErrorHandler`.
 */
export class BillingController {
  /** A price never changes its amount in Stripe, so its label is read once per process. */
  private priceLabel: string | undefined;

  /** `undefined` when billing is off. */
  private readonly service: BillingService | undefined;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly deps: BillingDeps,
  ) {
    this.service = createBillingService(prisma, deps);
  }

  /** The billing service. @throws BillingNotConfiguredError when Stripe isn't configured. */
  private requireService(): BillingService {
    if (!this.service) throw new BillingNotConfiguredError();
    return this.service;
  }

  /**
   * The plan's price as text, for display only. A Stripe outage (or a price id
   * that names nothing) degrades the page to "no price" rather than failing it.
   */
  private async readPriceLabel(): Promise<string | null> {
    if (this.priceLabel !== undefined) return this.priceLabel;
    if (!this.deps.stripe) return null;
    try {
      const price = await this.deps.stripe.gateway.findPrice(this.deps.stripe.priceId);
      if (!price) return null;
      this.priceLabel = formatPriceLabel(price);
      return this.priceLabel;
    } catch (err) {
      // The error's class only: its message can carry request details.
      console.error('[Billing] Could not read the price from Stripe', {
        error: err instanceof Error ? err.name : 'UnknownError',
      });
      return null;
    }
  }

  /**
   * GET /api/v1/billing
   *
   * The subscription as stored (the same values the gated feature reads), and
   * the plan's name and price.
   */
  async status(req: Request, res: Response): Promise<void> {
    const { userId } = getAuthenticatedUser(req);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelAtPeriodEnd: true,
      },
    });
    if (!user) throw new UserNotFoundError();

    const payload: BillingResponse = {
      billingEnabled: this.deps.stripe !== undefined,
      subscribed: isSubscribed(user.subscriptionStatus),
      status: user.subscriptionStatus,
      plan: { name: this.deps.planName, priceLabel: await this.readPriceLabel() },
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
    };
    sendData(res, payload);
  }

  /** POST /api/v1/billing/checkout: start a hosted Checkout for the plan and return its URL. */
  async checkout(req: Request, res: Response): Promise<void> {
    const service = this.requireService();
    const { userId } = getAuthenticatedUser(req);

    sendData(res, { url: await service.createCheckoutSession(userId) });
  }

  /** POST /api/v1/billing/portal: open the hosted Stripe customer portal and return its URL. */
  async portal(req: Request, res: Response): Promise<void> {
    const service = this.requireService();
    const { userId } = getAuthenticatedUser(req);

    sendData(res, { url: await service.createPortalSession(userId) });
  }
}
