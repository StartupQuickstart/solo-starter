'use client';

import { ReactNode } from 'react';

import { SearchInput } from '@/client/components/inputs/SearchInput';
import { cn } from '@/shared/lib/utils';

/**
 * TableToolbar - the row of controls that belongs to a table: search and
 * filters on the left, a count or a secondary action on the right.
 *
 * Pass it to `DataTable`'s `toolbar` prop and it sits inside the table's card,
 * above the column headers, so the controls and what they control read as one
 * object. The page's primary action stays in the page header, not here.
 *
 * @example
 * ```tsx
 * <DataTable
 *   toolbar={
 *     <TableToolbar
 *       search={{ value: search, onChange: setSearch, placeholder: 'Search notes' }}
 *       filters={<StatusSelect />}
 *       rightContent="40 notes"
 *     />
 *   }
 * />
 * ```
 */

export interface TableToolbarProps {
  /**
   * Search input configuration
   */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
  };

  /**
   * Filter elements (dropdowns, date pickers, etc.)
   */
  filters?: ReactNode;

  /**
   * Action buttons (export, etc.)
   */
  actions?: ReactNode;

  /**
   * Additional content on the left side
   */
  leftContent?: ReactNode;

  /**
   * Additional content on the right side: a count, a note
   */
  rightContent?: ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Stack on mobile
   * @default true
   */
  stackOnMobile?: boolean;
}

const DEFAULT_SEARCH_WIDTH = 'w-full sm:w-72';

export function TableToolbar({
  search,
  filters,
  actions,
  leftContent,
  rightContent,
  className,
  stackOnMobile = true,
}: TableToolbarProps) {
  const hasLeftContent = search || filters || leftContent;
  const hasRightContent = actions || rightContent;

  // If nothing to render, return null
  if (!hasLeftContent && !hasRightContent) {
    return null;
  }

  return (
    <div className={cn('flex gap-x-4 gap-y-2.5', stackOnMobile ? 'flex-col sm:flex-row sm:items-center' : 'flex-row items-center', className)}>
      {hasLeftContent && (
        <div className={cn('flex min-w-0 flex-1 items-center gap-2.5', stackOnMobile && 'flex-col items-stretch sm:flex-row sm:items-center')}>
          {search && (
            <SearchInput
              value={search.value}
              onChange={search.onChange}
              {...(search.placeholder ? { placeholder: search.placeholder } : {})}
              className={search.className ?? DEFAULT_SEARCH_WIDTH}
            />
          )}
          {filters && <div className="flex items-center gap-2">{filters}</div>}
          {leftContent}
        </div>
      )}

      {hasRightContent && (
        <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-[0.8125rem] tabular-nums">
          {rightContent}
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * TableToolbarSection - Wrapper for grouped toolbar elements
 */
export function TableToolbarSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-2', className)}>{children}</div>;
}
