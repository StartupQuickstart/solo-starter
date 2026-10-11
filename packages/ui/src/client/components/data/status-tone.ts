/**
 * Status tones: the one palette every status indicator draws from
 * (StatusBadge, StatusPill). Pick the tone by meaning, not by color:
 * `success` = live/good, `neutral` = finished or inert, `error` = cancelled or
 * failed, `warning` = needs attention, `info` = scheduled, `brand` = featured.
 */
export const STATUS_TONE = {
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
  neutral: 'neutral',
} as const;

export type StatusTone = (typeof STATUS_TONE)[keyof typeof STATUS_TONE];

export interface ToneStyles {
  readonly pill: string;
  readonly dot: string;
}

/**
 * Light-surface styles (cards, tables, forms): a soft tinted fill, an inset
 * hairline ring and -700 text so small labels clear WCAG AA. The dot carries
 * the saturated hue so the label never relies on color alone.
 */
export const LIGHT_TONE_STYLES: Readonly<Record<StatusTone, ToneStyles>> = {
  brand: {
    pill: 'bg-primary-soft text-primary-soft-foreground ring-primary/15',
    dot: 'bg-primary',
  },
  success: {
    pill: 'bg-success-soft text-success ring-success/15',
    dot: 'bg-success',
  },
  warning: {
    pill: 'bg-warning-soft text-warning ring-warning/15',
    dot: 'bg-warning',
  },
  error: {
    pill: 'bg-danger-soft text-destructive ring-destructive/15',
    dot: 'bg-destructive',
  },
  info: {
    pill: 'bg-info-soft text-primary-800 ring-primary/15',
    dot: 'bg-primary-500',
  },
  neutral: {
    pill: 'bg-secondary text-muted-foreground ring-foreground/10',
    dot: 'bg-[var(--tone-neutral)]',
  },
};

/** Dark-surface styles (DetailPageHero banners): -400 hues on /15 fills. */
export const DARK_TONE_STYLES: Readonly<Record<StatusTone, ToneStyles>> = {
  brand: { pill: 'bg-teal-400/15 text-teal-300', dot: 'bg-teal-400' },
  success: { pill: 'bg-emerald-400/15 text-emerald-400', dot: 'bg-emerald-400' },
  warning: { pill: 'bg-amber-400/15 text-amber-400', dot: 'bg-amber-400' },
  error: { pill: 'bg-red-400/15 text-red-400', dot: 'bg-red-400' },
  info: { pill: 'bg-sky-400/15 text-sky-300', dot: 'bg-sky-400' },
  neutral: { pill: 'bg-white/10 text-white/70', dot: 'bg-white/40' },
};

/** The solid colour of each tone, for bars, segments and other filled marks. */
export const TONE_FILL: Readonly<Record<StatusTone, string>> = {
  brand: 'bg-primary',
  info: 'bg-primary-400',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
  neutral: 'bg-[var(--tone-neutral)]',
};

/** The colour of an icon drawn in a tone, on a light surface. */
export const TONE_ICON: Readonly<Record<StatusTone, string>> = {
  brand: 'text-primary',
  info: 'text-primary-500',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
  neutral: 'text-muted-foreground',
};
