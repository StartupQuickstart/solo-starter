import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

export interface StatusScreenProps {
  /** A short code set very large behind the message: "404", "403". Decoration; the title says it in words. */
  readonly code?: string;
  readonly title: string;
  /** What happened and what to do about it, in a sentence or two. */
  readonly description: ReactNode;
  /** The way out: one button or link, two at most. */
  readonly children?: ReactNode;
  /** Fill the window, for a page with no shell around it. Inside the shell, leave it off. */
  readonly fullScreen?: boolean;
  /** Heading level of the title. A whole page uses h1; a state inside a page with its own h1 uses h2. @default 'h1' */
  readonly as?: 'h1' | 'h2';
  readonly className?: string;
}

/**
 * A whole screen given over to one message: the page does not exist, the
 * person may not see it, something broke. It says what happened in plain
 * words and offers the way out.
 *
 * @example
 * <StatusScreen code="404" title="This page does not exist" description="The link may be old, or the address mistyped.">
 *   <Button asChild><Link href="/">Back to the dashboard</Link></Button>
 * </StatusScreen>
 */
export function StatusScreen({ code, title, description, children, fullScreen = false, as: Heading = 'h1', className }: StatusScreenProps) {
  return (
    <div className={cn('bg-background flex flex-1 items-center px-6 py-16 sm:px-10', fullScreen ? 'min-h-dvh' : 'min-h-[60vh]', className)}>
      <div className="mx-auto w-full max-w-xl">
        {code && (
          <p aria-hidden className="font-display text-primary-200 text-[6.5rem] leading-[0.85] font-bold tracking-[-0.05em] select-none sm:text-[9.5rem]">
            {code}
          </p>
        )}
        <Heading className={cn('font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl', code && 'mt-5')}>{title}</Heading>
        <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed">{description}</p>
        {children && <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}
