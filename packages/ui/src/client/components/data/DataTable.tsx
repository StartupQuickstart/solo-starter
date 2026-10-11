'use client';

import type { ReactNode } from 'react';

import { Checkbox } from '@/client/components/ui/checkbox';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/client/components/ui/table';
import type { PageInfo } from '@/client/lib/apiClient';
import { cn } from '@/shared/lib/utils';

import { RowActionMenu, type RowAction } from './RowActionMenu';
import { SortableTableHead, type SortDirection, type SortState } from './SortableTableHead';
import { TablePagination } from './TablePagination';

export interface DataTableColumn<Row, SortKey extends string> {
  /** Unique within the table. */
  readonly id: string;
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  /** Makes the header a sort control for this key. */
  readonly sortKey?: SortKey;
  /** Direction applied when the column is first sorted. @default 'asc' */
  readonly firstDir?: SortDirection;
  readonly align?: 'left' | 'right';
  /** Classes for both the header and the cells, for widths and responsive hiding. */
  readonly className?: string;
}

export interface DataTableSelection {
  /** Ids of the selected rows. */
  readonly selected: ReadonlySet<string>;
  readonly onChange: (selected: Set<string>) => void;
}

export interface DataTableProps<Row, SortKey extends string> {
  /** The table's accessible name. */
  readonly label: string;
  readonly columns: readonly DataTableColumn<Row, SortKey>[];
  readonly rows: readonly Row[];
  readonly rowId: (row: Row) => string;
  /** The name of a row, for its checkbox and its actions menu ("Actions for Launch"). */
  readonly rowLabel: (row: Row) => string;
  /** The current sort and how to change it. Required when a column has a `sortKey`. */
  readonly sort?: SortState<SortKey> | undefined;
  readonly onSortChange?: ((next: SortState<SortKey>) => void) | undefined;
  /** Actions for a row, shown in a menu at the end of it. Return none to show no menu. */
  readonly rowActions?: ((row: Row) => readonly RowAction[]) | undefined;
  /** Adds a checkbox column. */
  readonly selection?: DataTableSelection | undefined;
  /** Shown with the range ("1-20 of 42 notes") under the table. */
  readonly pagination?: PageInfo | undefined;
  readonly onPageChange?: ((page: number) => void) | undefined;
  /** The plural noun for the range: "notes". */
  readonly itemLabel?: string;
  /** First load: shows placeholder rows in the table's own shape. */
  readonly isLoading?: boolean;
  /** A reload with rows already on screen: dims them and marks the table busy. */
  readonly isRefreshing?: boolean;
  /** Shown in place of the body when there are no rows: an EmptyState, usually. */
  readonly empty?: ReactNode;
  /** Controls that belong to the table (a TableToolbar, usually), shown inside the card above the headers. */
  readonly toolbar?: ReactNode;
  readonly className?: string;
}

const PLACEHOLDER_ROWS = 6;
/** Placeholder widths, so a loading table has the ragged edge of a real one. */
const PLACEHOLDER_WIDTHS = ['w-48', 'w-36', 'w-56', 'w-40', 'w-52', 'w-32'] as const;
const ACTIONS_COLUMN_CLASS = 'w-12 pl-0 text-right';
const SELECT_COLUMN_CLASS = 'w-10 pr-0';

/**
 * A table of records, with the parts a list screen needs built in: sortable
 * headers, a row menu, row selection, the pagination footer, and loading and
 * empty states.
 *
 * It holds no data and no state. Sort, page and selection are passed in and
 * changed through callbacks, so the same component serves a list sorted and
 * paged by the server (the usual case) and one sorted in the browser.
 */
export function DataTable<Row, SortKey extends string = never>({
  label,
  columns,
  rows,
  rowId,
  rowLabel,
  sort,
  onSortChange,
  rowActions,
  selection,
  pagination,
  onPageChange,
  itemLabel = 'rows',
  isLoading = false,
  isRefreshing = false,
  empty,
  toolbar,
  className,
}: DataTableProps<Row, SortKey>) {
  const ids = rows.map(rowId);
  const selectedCount = selection ? ids.filter((id) => selection.selected.has(id)).length : 0;
  const allSelected = ids.length > 0 && selectedCount === ids.length;

  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const id of ids) {
      if (allSelected) next.delete(id);
      else next.add(id);
    }
    selection.onChange(next);
  };

  const toggleRow = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  const showEmpty = !isLoading && rows.length === 0;

  return (
    <div
      aria-busy={isLoading || isRefreshing}
      data-slot="data-table"
      className={cn('bg-card overflow-hidden rounded-xl shadow-xs', className)}
    >
      {toolbar && (
        <div data-slot="data-table-toolbar" className="border-b px-4 py-3 sm:px-5">
          {toolbar}
        </div>
      )}
      <Table aria-label={label} className={cn('transition-opacity', isRefreshing && 'opacity-60')}>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className={SELECT_COLUMN_CLASS}>
                <Checkbox
                  aria-label="Select all rows"
                  checked={allSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  disabled={ids.length === 0}
                />
              </TableHead>
            )}
            {columns.map((column) =>
              column.sortKey && sort && onSortChange ? (
                <SortableTableHead
                  key={column.id}
                  label={column.header}
                  sortKey={column.sortKey}
                  sort={sort}
                  onSortChange={onSortChange}
                  {...(column.firstDir ? { firstDir: column.firstDir } : {})}
                  {...(column.align ? { align: column.align } : {})}
                  {...(column.className ? { className: column.className } : {})}
                />
              ) : (
                <TableHead key={column.id} className={cn(column.align === 'right' && 'text-right', column.className)}>
                  {column.header}
                </TableHead>
              ),
            )}
            {rowActions && (
              <TableHead className={ACTIONS_COLUMN_CLASS}>
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
              <TableRow key={index} aria-hidden>
                {selection && (
                  <TableCell className={SELECT_COLUMN_CLASS}>
                    <Skeleton className="size-4" />
                  </TableCell>
                )}
                {columns.map((column, cell) => (
                  <TableCell key={column.id} className={column.className}>
                    <Skeleton className={cn('h-4 max-w-full', cell === 0 ? PLACEHOLDER_WIDTHS[index % PLACEHOLDER_WIDTHS.length] : 'w-16')} />
                  </TableCell>
                ))}
                {rowActions && <TableCell className={ACTIONS_COLUMN_CLASS} />}
              </TableRow>
            ))}
          {!isLoading &&
            rows.map((row) => {
              const id = rowId(row);
              const name = rowLabel(row);
              const actions = rowActions?.(row) ?? [];
              const isSelected = selection?.selected.has(id) ?? false;
              return (
                <TableRow key={id} data-state={isSelected ? 'selected' : undefined} className="focus-within:bg-muted/60">
                  {selection && (
                    <TableCell className={SELECT_COLUMN_CLASS}>
                      <Checkbox aria-label={`Select ${name}`} checked={isSelected} onCheckedChange={() => toggleRow(id)} />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn(column.align === 'right' && 'text-right', column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className={ACTIONS_COLUMN_CLASS}>
                      {actions.length > 0 && <RowActionMenu label={name} actions={actions} />}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
      {isLoading && <span className="sr-only" role="status">{`Loading ${itemLabel}`}</span>}
      {showEmpty && empty}
      {!isLoading && !showEmpty && pagination && onPageChange && (
        <TablePagination pagination={pagination} onPageChange={onPageChange} itemLabel={itemLabel} />
      )}
    </div>
  );
}
