import React from 'react';

import { cn } from '@/shared/lib/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageHeader({ className, children, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn('flex w-full flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}
