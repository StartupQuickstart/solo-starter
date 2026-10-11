'use client';

import * as React from 'react';

import { cn } from '@/shared/lib/utils';

export interface FormSectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Actions rendered on the right of the section header. */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Appended after the standard content padding. */
  contentClassName?: string;
}

/**
 * Canonical form section: a card with an optional bordered header band
 * (title + description + actions) and padded content. Matches the list-card
 * surface used across the admin pages.
 */
export function FormSectionCard({
  title,
  description,
  headerActions,
  children,
  className,
  contentClassName,
}: FormSectionCardProps) {
  const hasHeader = title != null || description != null || headerActions != null;

  return (
    <div className={cn('bg-card rounded-xl shadow-xs', className)}>
      {hasHeader && (
        <div className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              {title != null && (
                <h2 className="text-[1.0625rem] font-semibold">{title}</h2>
              )}
              {description != null && (
                <p className="text-muted-foreground text-sm">{description}</p>
              )}
            </div>
            {headerActions != null && (
              <div className="flex items-center gap-2">{headerActions}</div>
            )}
          </div>
        </div>
      )}
      <div className={cn('p-6', contentClassName)}>{children}</div>
    </div>
  );
}
