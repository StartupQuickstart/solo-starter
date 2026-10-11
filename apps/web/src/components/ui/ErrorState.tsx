'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@app/ui';

export interface ErrorStateProps {
  /** What failed to load, e.g. "notes", which becomes "Couldn't load notes". */
  readonly what: string;
  /** Optional detail line under the title (defaults to a retry suggestion). */
  readonly description?: string;
  /** Retry handler, usually the query's refetch. Renders the button when set. */
  readonly onRetry?: () => void;
  /** Compact variant for inside cards (no vertical padding block). */
  readonly compact?: boolean;
}

/**
 * Standard data-loading error state: destructive-tinted icon ring, a clear
 * title, and a retry action. Replaces bare red text so failures give the
 * user a way forward instead of a dead end.
 */
export function ErrorState({ what, description, onRetry, compact = false }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-14'}`}
    >
      <div className="bg-destructive/10 flex h-11 w-11 items-center justify-center rounded-full">
        <AlertTriangle className="text-destructive size-5" aria-hidden />
      </div>
      <p className="mt-3 text-base font-medium">Couldn&apos;t load {what}</p>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {description ?? 'Something went wrong on our end. It’s usually temporary.'}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-4 gap-2">
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}
