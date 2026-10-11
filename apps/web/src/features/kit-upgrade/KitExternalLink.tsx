import { Button } from '@app/ui';
import { ArrowUpRight } from 'lucide-react';
import type { ComponentProps } from 'react';

import { NEW_TAB_HINT } from './kit-content';

export interface KitExternalLinkProps {
  /** An address outside the app. */
  readonly href: string;
  /** The link's visible words. */
  readonly label: string;
  readonly variant?: ComponentProps<typeof Button>['variant'];
  readonly size?: ComponentProps<typeof Button>['size'];
  readonly className?: string;
}

/**
 * A button that leaves the app for a page about the application kit. It opens
 * in a new tab, says so to assistive technology, and hands the new page no
 * reference back to this one.
 */
export function KitExternalLink({ href, label, variant, size, className }: KitExternalLinkProps) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <ArrowUpRight aria-hidden />{' '}
        <span className="sr-only">{NEW_TAB_HINT}</span>
      </a>
    </Button>
  );
}
