import { describe, expect, it } from 'vitest';

import { fakeSubscription } from '@/lib/billing/gateway.fake';
import { SUBSCRIPTION_STATUS } from '@/lib/billing/subscription';
import { billingReturnUrls, resolveSubscriptionState } from './billing.service';

const OLDER = new Date('2026-01-01T00:00:00.000Z');
const NEWER = new Date('2026-06-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-10-27T00:00:00.000Z');

const NOT_SUBSCRIBED = { subscriptionCurrentPeriodEnd: null, subscriptionCancelAtPeriodEnd: false } as const;

describe('resolveSubscriptionState', () => {
  it('has no status when the customer has no subscriptions', () => {
    expect(resolveSubscriptionState([])).toEqual({
      subscriptionStatus: null,
      stripeSubscriptionId: null,
      ...NOT_SUBSCRIBED,
    });
  });

  it('takes the status, id and period end of an active subscription', () => {
    expect(resolveSubscriptionState([fakeSubscription({ id: 'sub_1', currentPeriodEnd: PERIOD_END })])).toEqual({
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      stripeSubscriptionId: 'sub_1',
      subscriptionCurrentPeriodEnd: PERIOD_END,
      subscriptionCancelAtPeriodEnd: false,
    });
  });

  it('reports a subscription that is set to end', () => {
    const state = resolveSubscriptionState([fakeSubscription({ cancelAtPeriodEnd: true })]);

    expect(state.subscriptionCancelAtPeriodEnd).toBe(true);
    expect(state.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });

  it.each([SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.PAST_DUE])(
    'keeps the period end while the subscription is %s',
    (status) => {
      const state = resolveSubscriptionState([fakeSubscription({ status, currentPeriodEnd: PERIOD_END })]);

      expect(state.subscriptionStatus).toBe(status);
      expect(state.subscriptionCurrentPeriodEnd).toEqual(PERIOD_END);
    },
  );

  it.each([
    SUBSCRIPTION_STATUS.CANCELED,
    SUBSCRIPTION_STATUS.UNPAID,
    SUBSCRIPTION_STATUS.INCOMPLETE,
    SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
    SUBSCRIPTION_STATUS.PAUSED,
  ])('reports %s, with no period end, when that is the only subscription', (status) => {
    const state = resolveSubscriptionState([fakeSubscription({ id: 'sub_ended', status, cancelAtPeriodEnd: true })]);

    expect(state).toEqual({ subscriptionStatus: status, stripeSubscriptionId: 'sub_ended', ...NOT_SUBSCRIBED });
  });

  it('prefers a live subscription over a newer one that ended', () => {
    const state = resolveSubscriptionState([
      fakeSubscription({ id: 'sub_canceled', status: SUBSCRIPTION_STATUS.CANCELED, createdAt: NEWER }),
      fakeSubscription({ id: 'sub_live', createdAt: OLDER }),
    ]);

    expect(state.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(state.stripeSubscriptionId).toBe('sub_live');
  });

  it('takes the newest when two subscriptions are live', () => {
    const state = resolveSubscriptionState([
      fakeSubscription({ id: 'sub_old', createdAt: OLDER }),
      fakeSubscription({ id: 'sub_new', createdAt: NEWER }),
    ]);

    expect(state.stripeSubscriptionId).toBe('sub_new');
  });

  it('reports the most recent subscription when none is live', () => {
    const state = resolveSubscriptionState([
      fakeSubscription({ id: 'sub_first', status: SUBSCRIPTION_STATUS.CANCELED, createdAt: OLDER }),
      fakeSubscription({ id: 'sub_last', status: SUBSCRIPTION_STATUS.UNPAID, createdAt: NEWER }),
    ]);

    expect(state).toEqual({
      subscriptionStatus: SUBSCRIPTION_STATUS.UNPAID,
      stripeSubscriptionId: 'sub_last',
      ...NOT_SUBSCRIBED,
    });
  });

  it('does not depend on the order subscriptions are listed in', () => {
    const live = fakeSubscription({ id: 'sub_live', createdAt: OLDER });
    const ended = fakeSubscription({ id: 'sub_ended', status: SUBSCRIPTION_STATUS.CANCELED, createdAt: NEWER });

    expect(resolveSubscriptionState([live, ended])).toEqual(resolveSubscriptionState([ended, live]));
  });
});

describe('billingReturnUrls', () => {
  it('builds every URL on the configured web origin', () => {
    expect(billingReturnUrls('https://app.example.com')).toEqual({
      checkoutSuccess: 'https://app.example.com/billing?checkout=success',
      checkoutCancel: 'https://app.example.com/billing?checkout=canceled',
      portalReturn: 'https://app.example.com/billing',
    });
  });
});
