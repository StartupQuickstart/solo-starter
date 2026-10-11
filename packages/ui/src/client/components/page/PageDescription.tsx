import React from 'react';

import { cn } from '@/shared/lib/utils';

interface PageDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  size?: 'default' | 'lg';
}

const sizeClasses = {
  default: 'text-base sm:text-md',
  lg: 'text-lg',
};

export function PageDescription({ className, children, size = 'default', ...props }: PageDescriptionProps) {
  return (
    <p className={cn('text-muted-foreground max-w-2xl', sizeClasses[size], className)} {...props}>
      {children}
    </p>
  );
}
