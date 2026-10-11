import type { PriceSnapshot } from './gateway';

const LABEL_LOCALE = 'en-US';
const MINOR_UNIT_BASE = 10;

/**
 * A price as a person reads it: "$9.00 / month", "$90.00 / year",
 * "$24.00 / 3 months", or just the amount for a one-time price.
 *
 * Pure. Stripe sends amounts in the currency's smallest unit, and how many of
 * those make one whole unit depends on the currency (100 for USD, 1 for JPY),
 * so the divisor comes from the currency itself.
 *
 * @param price - The price as read from Stripe.
 */
export function formatPriceLabel(price: Pick<PriceSnapshot, 'unitAmount' | 'currency' | 'interval'>): string {
  const format = new Intl.NumberFormat(LABEL_LOCALE, { style: 'currency', currency: price.currency.toUpperCase() });
  const minorUnits = MINOR_UNIT_BASE ** (format.resolvedOptions().maximumFractionDigits ?? 0);
  const amount = format.format(price.unitAmount / minorUnits);

  if (!price.interval) return amount;
  const { unit, count } = price.interval;
  return count === 1 ? `${amount} / ${unit}` : `${amount} / ${count} ${unit}s`;
}
