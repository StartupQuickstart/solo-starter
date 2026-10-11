import { cn } from '@/shared/lib/utils';

import { StatusBadge } from '../data/StatusBadge';
import { DARK_TONE_STYLES, STATUS_TONE, type StatusTone } from '../data/status-tone';

export type StatusPillStatus = string;

export interface StatusPillProps {
  status: StatusPillStatus;
  /** Optional override label. Defaults to a formatted version of `status`. */
  label?: string;
  /**
   * `dark` for DetailPageHero banners, `light` for cards and tables.
   * @default 'dark'
   */
  surface?: 'dark' | 'light';
  className?: string;
}

/**
 * Tone per known status. A small generic map; apps add their own domain
 * statuses here. Keys are upper case and the lookup ignores case, so
 * `active` and `ACTIVE` read the same. Unknown statuses fall back to neutral.
 */
const STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  ACTIVE: STATUS_TONE.success,
  TRIALING: STATUS_TONE.success,
  ACCEPTED: STATUS_TONE.success,
  PENDING: STATUS_TONE.warning,
  DRAFT: STATUS_TONE.warning,
  PAST_DUE: STATUS_TONE.warning,
  CANCELED: STATUS_TONE.error,
  EXPIRED: STATUS_TONE.error,
  REVOKED: STATUS_TONE.error,
};

/** "PAST_DUE" → "Past Due" */
function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Status pill for a domain enum: maps the status to a tone and a readable
 * label. `surface="light"` renders the standard StatusBadge; the default dark
 * surface is tuned for hero banners.
 */
export function StatusPill({ status, label, surface = 'dark', className }: StatusPillProps) {
  const tone = STATUS_TONES[status.toUpperCase()] ?? STATUS_TONE.neutral;
  const resolvedLabel = label ?? formatStatusLabel(status);

  if (surface === 'light') {
    return <StatusBadge status={tone} label={resolvedLabel} className={className} />;
  }

  const styles = DARK_TONE_STYLES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-normal uppercase tracking-wider',
        styles.pill,
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', styles.dot)} />
      {resolvedLabel}
    </span>
  );
}
