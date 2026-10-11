/**
 * The slice of the payment provider the API uses.
 *
 * Business logic depends on this interface and never on the Stripe SDK, so it
 * is tested against the in-memory fake (`gateway.fake.ts`) instead of a mocked
 * SDK. `stripe-gateway.ts` is the one implementation and the only file that
 * imports `stripe`.
 */

/** One subscription, reduced to what the API reads. */
export interface SubscriptionSnapshot {
  readonly id: string;
  /** Stripe's subscription status (`active`, `past_due`, `canceled`, ...). */
  readonly status: string;
  /** End of the current billing period. */
  readonly currentPeriodEnd: Date;
  /** Whether the subscription is set to end instead of renewing. */
  readonly cancelAtPeriodEnd: boolean;
  /** When the subscription was created; the newest one wins when several exist. */
  readonly createdAt: Date;
}

/** How often a price bills. */
export interface PriceInterval {
  /** Stripe's unit: `day`, `week`, `month` or `year`. */
  readonly unit: string;
  /** How many units pass between charges (1 for monthly, 3 for quarterly). */
  readonly count: number;
}

/** An active price, reduced to what the billing page shows. */
export interface PriceSnapshot {
  readonly id: string;
  /** The amount in the currency's smallest unit (cents for USD). */
  readonly unitAmount: number;
  /** Three-letter ISO currency code, lowercase, as Stripe sends it. */
  readonly currency: string;
  /** `null` for a one-time price. */
  readonly interval: PriceInterval | null;
}

export interface CreateCustomerInput {
  readonly userId: string;
  /** Billing contact; receipts and invoices go here. */
  readonly email: string | undefined;
}

export interface CreateCheckoutSessionInput {
  readonly customerId: string;
  readonly priceId: string;
  /** Carried on the session and the subscription so the webhook can tie them to the user. */
  readonly userId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface CreatePortalSessionInput {
  readonly customerId: string;
  readonly returnUrl: string;
}

/** A webhook event whose signature has been verified, reduced to what the handler needs. */
export interface VerifiedBillingEvent {
  /** Stripe's event id; the de-duplication key. */
  readonly id: string;
  readonly type: string;
  /**
   * Present when the event means "this customer's subscription may have
   * changed". The handler then reads the customer's subscriptions from the
   * provider instead of trusting the event's own snapshot.
   */
  readonly subscriptionChange:
    | {
        readonly customerId: string;
        /** The user named on the session or subscription, if any. */
        readonly userId: string | undefined;
      }
    | undefined;
}

/** Thrown by `verifyEvent` when the signature is missing, wrong or too old. */
export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super('Invalid webhook signature');
    this.name = 'InvalidWebhookSignatureError';
  }
}

export interface BillingGateway {
  /** Create a customer for a user. The caller makes sure it is called once per user. */
  createCustomer(input: CreateCustomerInput): Promise<string>;
  /** Every subscription of the customer, in any status. */
  listSubscriptions(customerId: string): Promise<SubscriptionSnapshot[]>;
  /** The price with this id, or `undefined` when Stripe has no active price by that id. */
  findPrice(priceId: string): Promise<PriceSnapshot | undefined>;
  /** Start a hosted Checkout Session for one subscription. @returns The URL to send the browser to. */
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<string>;
  /** Start a hosted customer portal session. @returns The URL to send the browser to. */
  createPortalSession(input: CreatePortalSessionInput): Promise<string>;
  /** End a subscription now. Used when its user deletes their account. */
  cancelSubscription(subscriptionId: string): Promise<void>;
  /**
   * Verify a webhook request and return its event.
   *
   * @param rawBody - The request body exactly as received.
   * @param signature - The signature header.
   * @throws InvalidWebhookSignatureError when verification fails.
   */
  verifyEvent(rawBody: Buffer, signature: string): VerifiedBillingEvent;
}
