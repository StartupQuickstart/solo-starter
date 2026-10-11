import { cn } from '@/shared/lib/utils';

export interface PercentProps {
  /** The percentage value as a decimal (e.g., 0.076 for 7.6%, -0.023 for -2.3%) */
  value: number;
  /** Number of decimal places to show (default: 1) */
  decimalPlaces?: number;
  /** Whether to show a sign for positive values (default: false) */
  showSign?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function Percent({ value, decimalPlaces = 1, showSign = false, className }: PercentProps) {
  const formatPercentage = (num: number) => {
    const percentage = num * 100;
    const sign = showSign && percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(decimalPlaces)}%`;
  };

  return <span className={cn(className)}>{formatPercentage(value)}</span>;
}
