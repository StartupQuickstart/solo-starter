import { describe, expect, it } from 'vitest';

import { formatPriceLabel } from './price-label';

describe('formatPriceLabel', () => {
  it('shows a monthly price per month', () => {
    expect(formatPriceLabel({ unitAmount: 900, currency: 'usd', interval: { unit: 'month', count: 1 } })).toBe(
      '$9.00 / month',
    );
  });

  it('shows a yearly price per year', () => {
    expect(formatPriceLabel({ unitAmount: 9000, currency: 'usd', interval: { unit: 'year', count: 1 } })).toBe(
      '$90.00 / year',
    );
  });

  it('names the number of periods when a price bills less often than every period', () => {
    expect(formatPriceLabel({ unitAmount: 2400, currency: 'usd', interval: { unit: 'month', count: 3 } })).toBe(
      '$24.00 / 3 months',
    );
  });

  it('shows only the amount for a one-time price', () => {
    expect(formatPriceLabel({ unitAmount: 4900, currency: 'usd', interval: null })).toBe('$49.00');
  });

  it('does not divide a currency that has no smaller unit', () => {
    expect(formatPriceLabel({ unitAmount: 1200, currency: 'jpy', interval: { unit: 'month', count: 1 } })).toBe(
      '¥1,200 / month',
    );
  });

  it('uses the symbol of the price’s own currency', () => {
    expect(formatPriceLabel({ unitAmount: 1250, currency: 'eur', interval: null })).toBe('€12.50');
  });
});
