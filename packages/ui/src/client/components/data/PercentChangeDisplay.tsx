import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import { Percent } from './Percent';

export interface PercentChangeDisplayProps {
  /** The percentage change value as a decimal (e.g., 0.076 for 7.6%, -0.023 for -2.3%) */
  value: number;
  /** The label to display (e.g., "YoY", "MoM") */
  label: string;
  /** Number of decimal places to show (default: 1) */
  decimalPlaces?: number;
  /** Whether positive changes are considered good (default: true) */
  isPositiveGood?: boolean;
  /** Visual variant for styling */
  variant?: 'default' | 'success' | 'danger';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

export function PercentChangeDisplay({
  value,
  label,
  decimalPlaces = 1,
  isPositiveGood = true,
  variant = 'default',
  size = 'sm',
  className,
}: PercentChangeDisplayProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  const getVariantColor = () => {
    if (variant === 'success') return 'text-green-600 dark:text-green-400';
    if (variant === 'danger') return 'text-red-600 dark:text-red-400';

    // Default variant uses logic based on isPositiveGood
    if (isNeutral) return 'text-gray-500 dark:text-gray-400';
    const isGood = isPositive === isPositiveGood;
    return isGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getIcon = () => {
    if (isNeutral) return null;
    const IconComponent = isPositive ? TrendingUp : TrendingDown;
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    return <IconComponent className={iconSize} />;
  };

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('flex items-center gap-1', getVariantColor(), textSize, className)}>
      {getIcon()}
      <span>
        <Percent value={value} decimalPlaces={decimalPlaces} showSign /> {label}
      </span>
    </div>
  );
}
