import type { ReactNode } from 'react';

import { Error } from './Error';
import { Loading } from './Loading';

interface DataLoadingProps {
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error object if loading failed */
  error?: Error | null;
  /** Whether there's data to show */
  hasData?: boolean;
  /** Content to show when data is loaded successfully */
  children: ReactNode;
  /** Custom loading message (only for spinner type) */
  loadingMessage?: string;
  /** Custom error message */
  errorMessage?: string;
  /** Custom empty state component */
  emptyState?: ReactNode;
  /** Default empty state message */
  emptyMessage?: string;
  /** Retry function to pass to error component */
  onRetry?: () => void;
  /** Container wrapper - often a Card */
  wrapper?: (children: ReactNode) => ReactNode;
  /** Height to maintain during loading/error states */
  height?: string;
  /** Custom skeleton component for loading */
  skeleton?: ReactNode;
  /** Loading type - spinner or skeleton */
  loadingType?: 'spinner' | 'skeleton';
}

/**
 * Generic data loading wrapper that handles loading, error, and empty states
 */
export function DataLoading({
  isLoading,
  error,
  hasData = true,
  children,
  loadingMessage,
  errorMessage,
  emptyState,
  emptyMessage = 'No data available',
  onRetry,
  wrapper,
  height,
  skeleton,
  loadingType = 'spinner',
}: DataLoadingProps) {
  const wrapContent = (content: ReactNode) => {
    if (wrapper) {
      return wrapper(content);
    }
    return height ? <div style={{ height }}>{content}</div> : content;
  };

  // Loading state
  if (isLoading) {
    const loadingContent = loadingMessage ? (
      <Loading message={loadingMessage} />
    ) : (
      <Loading
        type={loadingType}
        skeleton={skeleton}
        message={loadingType === 'spinner' ? loadingMessage || 'Loading data...' : undefined}
      />
    );

    return wrapContent(loadingContent);
  }

  // Error state
  if (error) {
    const errorContent = (
      <Error
        error={error}
        message={errorMessage}
        onRetry={onRetry}
        description="Please try again or contact support if the issue persists."
      />
    );

    return wrapContent(errorContent);
  }

  // Empty state
  if (!hasData) {
    const emptyContent = emptyState || (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="text-muted-foreground">
          <div className="mb-2 text-lg">📊</div>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );

    return wrapContent(emptyContent);
  }

  // Success state - show the data
  return wrapContent(children);
}
