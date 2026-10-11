import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/client/components/ui/button';

interface ErrorProps {
  /** Error message to display */
  message?: string;
  /** Error object - will extract message if provided */
  error?: Error | null;
  /** Additional description or help text */
  description?: string;
  /** Custom icon to display instead of default AlertCircle */
  icon?: ReactNode;
  /** Show retry button */
  onRetry?: () => void;
  /** Custom retry button text */
  retryText?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Generic error display component with optional retry functionality
 */
export function Error({
  message,
  error,
  description,
  icon,
  onRetry,
  retryText = 'Try again',
  className = '',
  size = 'md',
}: ErrorProps) {
  const errorMessage = message || error?.message || 'An error occurred';

  const sizeClasses = {
    sm: 'text-sm gap-2 p-3',
    md: 'text-base gap-3 p-4',
    lg: 'text-lg gap-4 p-6',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg bg-red-50 dark:bg-red-950 ${sizeClasses[size]} ${className}`}
    >
      <div className="text-destructive flex items-center gap-2">
        {icon || <AlertCircle className={iconSizes[size]} />}
        <span className="font-medium">{errorMessage}</span>
      </div>

      {description && <p className="text-muted-foreground mt-1 text-center text-sm">{description}</p>}

      {onRetry && (
        <Button onClick={onRetry} variant="outline" size={size === 'lg' ? 'default' : 'sm'} className="mt-3">
          <RefreshCw className="mr-2 h-4 w-4" />
          {retryText}
        </Button>
      )}
    </div>
  );
}
