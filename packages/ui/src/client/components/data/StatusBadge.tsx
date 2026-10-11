'use client';

import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import { LIGHT_TONE_STYLES, STATUS_TONE, type StatusTone } from './status-tone';

/**
 * StatusBadge - a soft status pill (dot + label) for light surfaces.
 *
 * Pass the tone explicitly. For a domain enum (`ACTIVE`, `UPCOMING`, …) use
 * `StatusPill`, which maps the enum to a tone and a readable label for you.
 *
 * @example
 * ```tsx
 * <StatusBadge status="success" label="Paid" />
 * <StatusBadge status="warning" label="Payment due" />
 * <StatusBadge status="loading" label="Syncing" />
 * ```
 */

const SIZE_STYLES = {
  sm: 'h-5 px-2 text-[11px]',
  md: 'h-6 px-2.5 text-xs',
  lg: 'h-7 px-3 text-sm',
} as const;

export type StatusBadgeSize = keyof typeof SIZE_STYLES;
export type StatusBadgeStatus = StatusTone | 'loading';

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: StatusBadgeStatus;
  /** Reader-facing text, e.g. "Active", never a raw enum. */
  label: string;
  /** @default 'md' */
  size?: StatusBadgeSize;
  /** Replaces the status dot. */
  icon?: ReactNode;
  /** Hide the dot/icon. @default false */
  hideIcon?: boolean;
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  icon,
  hideIcon = false,
  className,
  ...props
}: StatusBadgeProps) {
  const isLoading = status === 'loading';
  const styles = LIGHT_TONE_STYLES[isLoading ? STATUS_TONE.neutral : status];

  const indicator =
    icon ??
    (isLoading ? (
      <Loader2 aria-hidden className="size-3 animate-spin" />
    ) : (
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', styles.dot)} />
    ));

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
        SIZE_STYLES[size],
        styles.pill,
        className
      )}
      {...props}
    >
      {!hideIcon && indicator}
      {label}
    </span>
  );
}

/**
 * Convenience components for common statuses
 */

export function SuccessBadge({ label, ...props }: Omit<StatusBadgeProps, 'status'>) {
  return <StatusBadge status="success" label={label} {...props} />;
}

export function ErrorBadge({ label, ...props }: Omit<StatusBadgeProps, 'status'>) {
  return <StatusBadge status="error" label={label} {...props} />;
}

export function WarningBadge({ label, ...props }: Omit<StatusBadgeProps, 'status'>) {
  return <StatusBadge status="warning" label={label} {...props} />;
}

export function InfoBadge({ label, ...props }: Omit<StatusBadgeProps, 'status'>) {
  return <StatusBadge status="info" label={label} {...props} />;
}

export function LoadingBadge({
  label = 'Loading...',
  ...props
}: Omit<StatusBadgeProps, 'status' | 'label'> & { label?: string }) {
  return <StatusBadge status="loading" label={label} {...props} />;
}
