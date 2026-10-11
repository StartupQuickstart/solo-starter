import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface LoadingProps {
  /** Loading message to display */
  message?: string;
  /** Custom spinner component */
  spinner?: ReactNode;
  /** Show skeleton instead of spinner */
  skeleton?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading type - spinner shows rotating icon, skeleton shows placeholder content */
  type?: 'spinner' | 'skeleton';
}

/**
 * Generic loading display component with spinner or skeleton options
 */
export function Loading({ message, spinner, skeleton, className = '', size = 'md', type = 'spinner' }: LoadingProps) {
  const sizeClasses = {
    sm: 'text-sm gap-2 p-3',
    md: 'text-base gap-3 p-4',
    lg: 'text-lg gap-4 p-6',
  };

  const spinnerSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  // Show skeleton if provided and type is skeleton
  if (type === 'skeleton' && skeleton) {
    return <div className={className}>{skeleton}</div>;
  }

  // Default loading message
  const loadingMessage = message || 'Loading...';

  return (
    <div className={`flex flex-col items-center justify-center ${sizeClasses[size]} ${className}`}>
      <div className="text-muted-foreground flex items-center gap-2">
        {spinner || <Loader2 className={`${spinnerSizes[size]} animate-spin`} />}
        <span>{loadingMessage}</span>
      </div>
    </div>
  );
}
