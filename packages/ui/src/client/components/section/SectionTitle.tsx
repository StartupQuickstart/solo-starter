import React from 'react';

import { cn } from '@/shared/lib/utils';

interface SectionTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  as?: 'h2' | 'h3' | 'h4';
}

export function SectionTitle({ className, children, as: Component = 'h2', ...props }: SectionTitleProps) {
  return (
    <Component
      className={cn('text-foreground text-xl font-semibold tracking-tight', 'sm:text-2xl', className)}
      {...props}
    >
      {children}
    </Component>
  );
}
