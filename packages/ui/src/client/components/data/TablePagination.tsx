'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/client/components/ui/button';
import type { PageInfo } from '@/client/lib/apiClient';

export interface TablePaginationProps {
  readonly pagination: PageInfo;
  readonly onPageChange: (page: number) => void;
  /** Plural noun for the count, e.g. "polls" → "1–20 of 57 polls". */
  readonly itemLabel: string;
}

/**
 * Footer row for a table card: the visible range and total on the left,
 * previous/next on the right (hidden when everything fits on one page).
 */
export function TablePagination({ pagination, onPageChange, itemLabel }: TablePaginationProps) {
  const { page, pageSize, total, totalPages } = pagination;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="text-muted-foreground flex min-h-12 items-center justify-between gap-4 border-t px-4 py-2 text-[0.8125rem] sm:px-5">
      <p aria-live="polite" className="tabular-nums">
        {first}–{last} of {total} {itemLabel}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="mr-2 hidden tabular-nums sm:inline">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
