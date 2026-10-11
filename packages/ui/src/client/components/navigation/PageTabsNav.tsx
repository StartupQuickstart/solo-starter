'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/shared/lib/utils';

export interface PageTabsNavItem {
  label: string;
  /** Exact path this tab links to, e.g. `/profile` or `/profile/preferences`. */
  href: string;
}

export interface PageTabsNavProps {
  items: readonly PageTabsNavItem[];
  'aria-label'?: string;
  className?: string;
}

/**
 * Tabs-styled sub-navigation across separate pages (each tab is a real URL,
 * matched against `usePathname()`), not the Radix `Tabs` state used for
 * same-page filters. Shares the pill look of `TabsList`/`TabsTrigger` so the
 * two read as one family.
 */
export function PageTabsNav({ items, 'aria-label': ariaLabel, className }: PageTabsNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-sm font-medium transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:outline-1 focus-visible:ring-[3px]',
              isActive &&
                'bg-background dark:border-input dark:bg-input/30 shadow-sm dark:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
