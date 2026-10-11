import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Icon shown on the primary-tinted tile. */
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description?: string;
  /** Action slot (link or button) rendered under the description. */
  readonly children?: ReactNode;
  /** Compact variant for inside an existing card (no surface of its own). */
  readonly compact?: boolean;
}

/**
 * The standard empty state: an icon, what will live here, and the first
 * action. Presented on the same card surface as the populated list it
 * replaces, so it reads as content and not as a blank page. Use `compact`
 * when the surrounding element already provides the card.
 */
export function EmptyState({ icon: Icon, title, description, children, compact = false }: EmptyStateProps) {
  return (
    <div className={compact ? 'px-6 py-12 text-center' : 'bg-card rounded-xl px-6 py-16 text-center shadow-xs'}>
      <div className="bg-primary-soft text-primary ring-primary/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-xl ring-1 ring-inset">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="font-display text-lg font-semibold tracking-[-0.015em]">{title}</p>
      {description && <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-relaxed">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
