import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

/** How far a panel lifts off the canvas. `raised` is for the one thing a screen leads with. */
export const PANEL_ELEVATION = { flat: 'flat', raised: 'raised' } as const;
export type PanelElevation = (typeof PANEL_ELEVATION)[keyof typeof PANEL_ELEVATION];

export interface PanelProps {
  readonly title: string;
  /** One line under the title. */
  readonly description?: ReactNode;
  /** Controls on the right of the header: a link, a toggle. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  /** @default 'flat' */
  readonly elevation?: PanelElevation;
  /** Heading level of the title. @default 'h2' */
  readonly as?: 'h2' | 'h3';
  readonly className?: string;
  readonly contentClassName?: string;
}

/**
 * A titled surface for content that is read rather than filled in: a
 * list, a breakdown. (Settings that are saved together go in FormSectionCard.)
 */
export function Panel({
  title,
  description,
  actions,
  children,
  elevation = PANEL_ELEVATION.flat,
  as: Heading = 'h2',
  className,
  contentClassName,
}: PanelProps) {
  return (
    <section
      aria-label={title}
      data-slot="panel"
      className={cn('bg-card flex min-w-0 flex-col rounded-xl', elevation === PANEL_ELEVATION.raised ? 'shadow-md' : 'shadow-xs', className)}
    >
      <header className="flex items-start justify-between gap-x-4 px-6 pt-5">
        <div className="min-w-0">
          <Heading className="text-[1.0625rem] font-semibold leading-snug">{title}</Heading>
          {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={cn('flex-1 px-6 pt-4 pb-6', contentClassName)}>{children}</div>
    </section>
  );
}
