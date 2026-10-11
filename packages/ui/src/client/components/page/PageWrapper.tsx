import React from 'react';

import { cn } from '@/shared/lib/utils';

interface PageWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxWidth?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const maxWidthMap = {
  none: '',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

// Mobile drops the wrapper gutter entirely: PageSection carries its own
// responsive px, and stacking both reads as excessive padding on phones.
const paddingMap = {
  none: '',
  sm: 'p-0 sm:p-2',
  md: 'p-0 sm:p-4',
  lg: 'p-0 sm:p-6',
};

export function PageWrapper({ children, maxWidth = 'none', padding = 'md', className, ...props }: PageWrapperProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-4 overflow-auto',
        maxWidthMap[maxWidth],
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
