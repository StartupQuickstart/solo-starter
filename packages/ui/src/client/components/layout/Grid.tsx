import React from 'react';

import { cn } from '@/shared/lib/utils';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  items?: 'start' | 'end' | 'center' | 'stretch';
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  responsive?: boolean;
}

interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'full';
  start?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
  end?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
}

const gridColsMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

const gapMap = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

const itemsMap = {
  start: 'items-start',
  end: 'items-end',
  center: 'items-center',
  stretch: 'items-stretch',
};

const justifyMap = {
  start: 'justify-start',
  end: 'justify-end',
  center: 'justify-center',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const spanMap = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
  full: 'col-span-full',
};

const startMap = {
  1: 'col-start-1',
  2: 'col-start-2',
  3: 'col-start-3',
  4: 'col-start-4',
  5: 'col-start-5',
  6: 'col-start-6',
  7: 'col-start-7',
  8: 'col-start-8',
  9: 'col-start-9',
  10: 'col-start-10',
  11: 'col-start-11',
  12: 'col-start-12',
  13: 'col-start-13',
};

const endMap = {
  1: 'col-end-1',
  2: 'col-end-2',
  3: 'col-end-3',
  4: 'col-end-4',
  5: 'col-end-5',
  6: 'col-end-6',
  7: 'col-end-7',
  8: 'col-end-8',
  9: 'col-end-9',
  10: 'col-end-10',
  11: 'col-end-11',
  12: 'col-end-12',
  13: 'col-end-13',
};

export function Grid({
  children,
  cols = 12,
  gap = 'md',
  items = 'stretch',
  justify,
  responsive = true,
  className,
  ...props
}: GridProps) {
  const gridClasses = cn(
    'grid',
    gridColsMap[cols],
    gapMap[gap],
    itemsMap[items],
    justify && justifyMap[justify],
    responsive && 'sm:grid-cols-12', // Default to 12 columns on larger screens
    className
  );

  return (
    <div className={gridClasses} {...props}>
      {children}
    </div>
  );
}

export function GridItem({ children, span, start, end, className, ...props }: GridItemProps) {
  const itemClasses = cn(span && spanMap[span], start && startMap[start], end && endMap[end], className);

  return (
    <div className={itemClasses} {...props}>
      {children}
    </div>
  );
}

// Convenience components for common patterns
interface GridHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
}

export function GridHeader({ title, actions, className, ...props }: GridHeaderProps) {
  return (
    <Grid cols={12} gap="md" items="center" className={cn('w-full', className)} {...props}>
      <GridItem span="full" className={actions ? 'sm:col-span-8' : undefined}>
        {title}
      </GridItem>
      {actions && (
        <GridItem span="full" className="flex justify-start sm:col-span-4 sm:justify-end">
          {actions}
        </GridItem>
      )}
    </Grid>
  );
}
