/**
 * In-memory `BillingGateway` for tests. It holds customers, subscriptions and
 * prices as state, so tests assert on what the billing code reads and writes
 * rather than on which SDK method was called in what order.
 */
import {
  InvalidWebhookSignatureError,
  type BillingGateway,
  type CreateCheckoutSessionInput,
  type CreateCustomerInput,
  type CreatePortalSessionInput,
  type PriceSnapshot,
  type SubscriptionSnapshot,
  type VerifiedBillingEvent,
} from './gateway';
import { SUBSCRIPTION_STATUS } from './subscription';

/** The signature the fake accepts. Anything else is an invalid signature. */
export const FAKE_VALID_SIGNATURE = 'valid-signature';

/** The one price the fake holds: nine dollars a month. */
export const FAKE_PRICE: PriceSnapshot = {
  id: 'price_fake_monthly',
  unitAmount: 900,
  currency: 'usd',
  interval: { unit: 'month', count: 1 },
};

/** A subscription, active unless overridden. */
export function fakeSubscription(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    id: 'sub_fake',
    status: SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodEnd: new Date('2026-10-27T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-09-27T00:00:00.000Z'),
    ...overrides,
  };
}

export class FakeBillingGateway implements BillingGateway {
  /** Customers created through the gateway. */
  readonly customers: Array<CreateCustomerInput & { readonly id: string }> = [];
  /** Subscriptions by customer id. Tests change these to stand for what Stripe holds. */
  readonly subscriptions = new Map<string, SubscriptionSnapshot[]>();
  /** Active prices. Empty it to stand for a price nobody created. */
  prices: PriceSnapshot[] = [FAKE_PRICE];
  readonly checkoutSessions: CreateCheckoutSessionInput[] = [];
  readonly portalSessions: CreatePortalSessionInput[] = [];
  /** How many times a price was looked up. */
  priceLookups = 0;
  /** Set to make every call fail the way an outage would. */
  failure: Error | undefined;
  /**
   * Runs after `listSubscriptions` has taken its answer and before it returns
   * it. Lets a test change what the provider holds while a read is in flight.
   */
  afterSnapshot: (() => Promise<void>) | undefined;

  private throwIfFailing(): void {
    if (this.failure) throw this.failure;
  }

  /** Replace what the provider holds for a customer. */
  setSubscriptions(customerId: string, subscriptions: SubscriptionSnapshot[]): void {
    this.subscriptions.set(customerId, subscriptions);
  }

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    this.throwIfFailing();
    const id = `cus_fake_${this.customers.length + 1}`;
    this.customers.push({ ...input, id });
    return id;
  }

  async listSubscriptions(customerId: string): Promise<SubscriptionSnapshot[]> {
    this.throwIfFailing();
    const snapshot = [...(this.subscriptions.get(customerId) ?? [])];
    await this.afterSnapshot?.();
    return snapshot;
  }

  async findPrice(priceId: string): Promise<PriceSnapshot | undefined> {
    this.throwIfFailing();
    this.priceLookups += 1;
    return this.prices.find((price) => price.id === priceId);
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<string> {
    this.throwIfFailing();
    this.checkoutSessions.push(input);
    return `https://checkout.example.com/session_${this.checkoutSessions.length}`;
  }

  async createPortalSession(input: CreatePortalSessionInput): Promise<string> {
    this.throwIfFailing();
    this.portalSessions.push(input);
    return `https://portal.example.com/session_${this.portalSessions.length}`;
  }

  /** Marks the subscription canceled wherever it is held, as the provider would. */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    this.throwIfFailing();
    for (const [customerId, held] of this.subscriptions) {
      this.subscriptions.set(
        customerId,
        held.map((subscription) =>
          subscription.id === subscriptionId ? { ...subscription, status: SUBSCRIPTION_STATUS.CANCELED } : subscription,
        ),
      );
    }
  }

  /** The body is the event itself, as JSON. Only `FAKE_VALID_SIGNATURE` verifies. */
  verifyEvent(rawBody: Buffer, signature: string): VerifiedBillingEvent {
    if (signature !== FAKE_VALID_SIGNATURE) throw new InvalidWebhookSignatureError();
    return JSON.parse(rawBody.toString('utf8')) as VerifiedBillingEvent;
  }
}
