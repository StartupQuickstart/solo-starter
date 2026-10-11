import { describe, expect, it } from 'vitest';

import { isSubscribed, SUBSCRIPTION_STATUS } from './subscription';

describe('isSubscribed', () => {
  it.each([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING])('counts %s as subscribed', (status) => {
    expect(isSubscribed(status)).toBe(true);
  });

  it('keeps a user subscribed while a failed renewal payment is being retried', () => {
    expect(isSubscribed(SUBSCRIPTION_STATUS.PAST_DUE)).toBe(true);
  });

  it.each([
    SUBSCRIPTION_STATUS.CANCELED,
    SUBSCRIPTION_STATUS.UNPAID,
    SUBSCRIPTION_STATUS.INCOMPLETE,
    SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
    SUBSCRIPTION_STATUS.PAUSED,
  ])('does not count %s', (status) => {
    expect(isSubscribed(status)).toBe(false);
  });

  it.each([null, undefined, '', 'ACTIVE', 'something-new'])('does not count %s', (status) => {
    expect(isSubscribed(status)).toBe(false);
  });
});
