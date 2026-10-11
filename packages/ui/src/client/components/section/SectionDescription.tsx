import React from 'react';

import { cn } from '@/shared/lib/utils';

interface SectionDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function SectionDescription({ className, children, ...props }: SectionDescriptionProps) {
  return (
    <p className={cn('text-muted-foreground max-w-xl text-sm', 'sm:text-base', className)} {...props}>
      {children}
    </p>
  );
}
