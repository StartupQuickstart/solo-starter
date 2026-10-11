import { Loader2 } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

export const SPINNER_SIZE = { sm: 'sm', md: 'md', lg: 'lg' } as const;
export type SpinnerSize = (typeof SPINNER_SIZE)[keyof typeof SPINNER_SIZE];

const SIZE_CLASS: Readonly<Record<SpinnerSize, string>> = { sm: 'size-4', md: 'size-5', lg: 'size-8' };

export interface SpinnerProps {
  /** What is loading, for screen readers. @default 'Loading' */
  readonly label?: string;
  readonly size?: SpinnerSize;
  readonly className?: string | undefined;
}

/**
 * A small "working" indicator for a button, a card or an inline wait. For a
 * whole page or a list, prefer a Skeleton: it shows the shape of what is
 * coming. The rotation stops for people who ask for reduced motion.
 */
export function Spinner({ label = 'Loading', size = SPINNER_SIZE.md, className }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center', className)}>
      <Loader2 aria-hidden className={cn('animate-spin motion-reduce:animate-none', SIZE_CLASS[size])} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
