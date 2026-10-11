import React from 'react';

import { cn } from '@/shared/lib/utils';

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function SectionHeader({ className, children, ...props }: SectionHeaderProps) {
  return (
    <div
      className={cn('mb-4 flex flex-col gap-1', 'sm:flex-row sm:items-center sm:justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
}
