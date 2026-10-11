import React from 'react';

import { cn } from '@/shared/lib/utils';

interface PageActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageActions({ className, children, ...props }: PageActionsProps) {
  return (
    <div className={cn('flex items-center justify-start gap-2 sm:justify-end', className)} {...props}>
      {children}
    </div>
  );
}
