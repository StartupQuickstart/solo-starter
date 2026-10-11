import React from 'react';

import { cn } from '@/shared/lib/utils';

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  size?: 'default' | 'lg';
}

const sizeClasses = {
  default: 'text-[1.75rem] leading-[1.1] sm:text-[2.125rem]',
  lg: 'text-4xl lg:text-5xl',
};

export function PageTitle({ className, children, as: Component = 'h1', size = 'default', ...props }: PageTitleProps) {
  return (
    <Component className={cn('text-foreground font-display font-semibold tracking-[-0.02em]', sizeClasses[size], className)} {...props}>
      {children}
    </Component>
  );
}
