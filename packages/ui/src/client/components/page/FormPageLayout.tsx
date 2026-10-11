'use client';

import * as React from 'react';

import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// FormPageLayout: three-zone form page: top bar, scrolling centered content,
// bottom save bar.
//
// The admin shell's <main> is the scroll container, so the header/footer pin
// with `sticky` rather than a full-height flex column: visually identical,
// but independent of the parent layout's flex behavior.
// ---------------------------------------------------------------------------

const MAX_WIDTH_CLASSES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

const DEFAULT_MAX_WIDTH = '4xl';

function maxWidthClass(maxWidth: string): string {
  return MAX_WIDTH_CLASSES[maxWidth] ?? MAX_WIDTH_CLASSES[DEFAULT_MAX_WIDTH]!;
}

interface FormPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

function FormPageLayoutRoot({ children, className }: FormPageLayoutProps) {
  return <div className={cn('flex min-h-full flex-col', className)}>{children}</div>;
}

// ── Header ──────────────────────────────────────────────────────────────────

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
}

function Header({ children, className }: HeaderProps) {
  return (
    <div
      className={cn(
        'bg-card sticky top-0 z-10 flex min-h-[65px] shrink-0 items-center border-b px-4 py-3 sm:px-6 sm:py-4',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-4">
        {children}
      </div>
    </div>
  );
}

// ── Content ─────────────────────────────────────────────────────────────────

interface ContentProps {
  children: React.ReactNode;
  /** Max width key for the centered column (default '4xl'). */
  maxWidth?: string;
  className?: string;
}

function Content({ children, maxWidth = DEFAULT_MAX_WIDTH, className }: ContentProps) {
  return (
    <div className={cn('bg-background flex-1 p-4 sm:p-6', className)}>
      <div className={cn('mx-auto space-y-6', maxWidthClass(maxWidth))}>{children}</div>
    </div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────

interface FooterProps {
  children: React.ReactNode;
  /** Max width key matching Content so the actions align with the form. */
  maxWidth?: string;
  className?: string;
  /** When set, shows a "Last saved" timestamp on the left of the bar. */
  lastSaved?: Date | null;
}

function formatLastSaved(date: Date): string {
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `Last saved: ${dateStr} at ${timeStr}`;
}

function Footer({ children, maxWidth = DEFAULT_MAX_WIDTH, className, lastSaved }: FooterProps) {
  return (
    <div
      className={cn('bg-card sticky bottom-0 z-10 shrink-0 border-t px-4 py-3 sm:px-6', className)}
    >
      <div
        className={cn(
          'mx-auto flex flex-col items-center justify-between gap-3 sm:flex-row',
          maxWidthClass(maxWidth),
        )}
      >
        <div className="text-muted-foreground text-sm">{lastSaved && formatLastSaved(lastSaved)}</div>
        {children}
      </div>
    </div>
  );
}

export const FormPageLayout = Object.assign(FormPageLayoutRoot, {
  Header,
  Content,
  Footer,
});
