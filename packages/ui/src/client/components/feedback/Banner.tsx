import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

export const BANNER_TONE = { info: 'info', success: 'success', warning: 'warning', error: 'error' } as const;
export type BannerTone = (typeof BANNER_TONE)[keyof typeof BANNER_TONE];

const TONE: Readonly<Record<BannerTone, { readonly icon: LucideIcon; readonly className: string; readonly urgent: boolean }>> = {
  info: { icon: Info, className: 'border-sky-200 bg-sky-50 text-sky-950', urgent: false },
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-950', urgent: false },
  warning: { icon: AlertTriangle, className: 'border-amber-300 bg-amber-50 text-amber-950', urgent: true },
  error: { icon: XCircle, className: 'border-red-200 bg-red-50 text-red-950', urgent: true },
};

export interface BannerProps {
  readonly tone?: BannerTone;
  readonly title: string;
  /** More detail under the title. */
  readonly children?: ReactNode;
  /** A button or link offering the way forward. */
  readonly action?: ReactNode;
  /** Shows a close button and is called when it is pressed. */
  readonly onDismiss?: (() => void) | undefined;
  readonly className?: string | undefined;
}

/**
 * A message across the top of a page or a card: something the person should
 * know about this screen (a failed payment, a read-only mode, a finished
 * import). For the result of an action they just took, use a toast.
 *
 * Warnings and errors are announced at once (`role="alert"`); information and
 * success wait their turn (`role="status"`). The tone is carried by the icon
 * and the words as well as the colour.
 */
export function Banner({ tone = BANNER_TONE.info, title, children, action, onDismiss, className }: BannerProps) {
  const { icon: Icon, className: toneClass, urgent } = TONE[tone];

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', toneClass, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-0.5 opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="focus-visible:ring-ring -m-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
