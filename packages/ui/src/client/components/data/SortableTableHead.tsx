'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { TableHead } from '@/client/components/ui/table';
import { cn } from '@/shared/lib/utils';

export const SORT_DIRECTION = { asc: 'asc', desc: 'desc' } as const;
export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

export interface SortState<K extends string> {
  readonly key: K;
  readonly dir: SortDirection;
}

export interface SortableTableHeadProps<K extends string> {
  readonly label: string;
  readonly sortKey: K;
  readonly sort: SortState<K>;
  readonly onSortChange: (next: SortState<K>) => void;
  /**
   * Direction applied when this column is first selected. Use `desc` for
   * numbers and dates people want "biggest / latest first".
   * @default 'asc'
   */
  readonly firstDir?: SortDirection;
  readonly align?: 'left' | 'right';
  readonly className?: string;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

/**
 * A table header cell that sorts its column. Clicking the active column flips
 * the direction; clicking another column selects it at `firstDir`.
 */
export function SortableTableHead<K extends string>({
  label,
  sortKey,
  sort,
  onSortChange,
  firstDir = SORT_DIRECTION.asc,
  align = 'left',
  className,
}: SortableTableHeadProps<K>) {
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ChevronsUpDown : sort.dir === SORT_DIRECTION.asc ? ArrowUp : ArrowDown;

  const handleClick = () => {
    if (!isActive) {
      onSortChange({ key: sortKey, dir: firstDir });
      return;
    }
    onSortChange({ key: sortKey, dir: sort.dir === SORT_DIRECTION.asc ? SORT_DIRECTION.desc : SORT_DIRECTION.asc });
  };

  return (
    <TableHead aria-sort={isActive ? ARIA_SORT[sort.dir] : 'none'} className={cn(align === 'right' && 'text-right', className)}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'group -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
          'hover:text-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          align === 'right' && 'flex-row-reverse',
          isActive && 'text-foreground'
        )}
      >
        {label}
        <Icon
          aria-hidden
          className={cn('size-3.5 shrink-0', !isActive && 'opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60')}
        />
      </button>
    </TableHead>
  );
}
