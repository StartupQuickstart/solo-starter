import { cn } from '@/shared/lib/utils';

export type DisplayType = 'number' | 'currency' | 'percentage' | 'compact' | 'scientific';

export type NumberFormat = 'short' | 'long' | 'standard';

export interface ValueDisplayOptions {
  /** Number of decimal places to show */
  decimalPlaces?: number;
  /** Number format style */
  format?: NumberFormat;
  /** Currency code (USD, EUR, etc.) - only used with currency displayType */
  currency?: string;
  /** Whether to show a sign for positive values */
  showSign?: boolean;
  /** Prefix to add before the value */
  prefix?: string;
  /** Suffix to add after the value */
  suffix?: string;
  /** Minimum value to show (values below will show as "< min") */
  minimum?: number;
  /** Maximum value to show (values above will show as "> max") */
  maximum?: number;
}

export interface ValueDisplayProps {
  /** The numeric value to display */
  value: number;
  /** How to format and display the value */
  displayType?: DisplayType;
  /** Additional formatting options */
  options?: ValueDisplayOptions;
  /** Additional CSS classes */
  className?: string;
}

export function ValueDisplay({ value, displayType = 'number', options = {}, className }: ValueDisplayProps) {
  const {
    decimalPlaces = 1,
    format = 'standard',
    currency = 'USD',
    showSign = false,
    prefix = '',
    suffix = '',
    minimum,
    maximum,
  } = options;

  // Handle min/max bounds
  if (minimum !== undefined && value < minimum) {
    return (
      <span className={cn(className)}>
        {'< '}
        {formatValue(minimum)}
      </span>
    );
  }
  if (maximum !== undefined && value > maximum) {
    return (
      <span className={cn(className)}>
        {'> '}
        {formatValue(maximum)}
      </span>
    );
  }

  function formatValue(val: number): string {
    const sign = showSign && val > 0 ? '+' : '';

    switch (displayType) {
      case 'currency':
        return `${sign}${formatCurrency(val)}`;

      case 'percentage':
        return `${sign}${formatPercentage(val)}`;

      case 'compact':
        return `${sign}${formatCompact(val)}`;

      case 'scientific':
        return `${sign}${val.toExponential(decimalPlaces)}`;

      case 'number':
      default:
        return `${sign}${formatNumber(val)}`;
    }
  }

  function formatNumber(val: number): string {
    if (format === 'short') {
      return formatCompact(val);
    }
    if (format === 'long') {
      return val.toLocaleString('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });
    }
    // standard
    return val.toFixed(decimalPlaces);
  }

  function formatCurrency(val: number): string {
    if (format === 'short') {
      const formatted = formatCompact(Math.abs(val));
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(0)
        .replace('0', formatted);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: format === 'long' ? decimalPlaces : 0,
      maximumFractionDigits: decimalPlaces,
    }).format(val);
  }

  function formatPercentage(val: number): string {
    const percentage = val * 100;
    if (format === 'short' && Math.abs(percentage) >= 1000) {
      return formatCompact(percentage / 100) + '%';
    }
    return `${percentage.toFixed(decimalPlaces)}%`;
  }

  function formatCompact(val: number): string {
    const absVal = Math.abs(val);

    if (absVal >= 1e12) {
      return `${(val / 1e12).toFixed(decimalPlaces)}T`;
    }
    if (absVal >= 1e9) {
      return `${(val / 1e9).toFixed(decimalPlaces)}B`;
    }
    if (absVal >= 1e6) {
      return `${(val / 1e6).toFixed(decimalPlaces)}M`;
    }
    if (absVal >= 1e3) {
      return `${(val / 1e3).toFixed(decimalPlaces)}K`;
    }

    return val.toFixed(decimalPlaces);
  }

  const formattedValue = formatValue(value);

  return (
    <span className={cn(className)}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}
