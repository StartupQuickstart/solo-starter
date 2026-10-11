import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { DataLoading } from './DataLoading';

interface QueryLoadingProps<T> {
  /** React Query result object */
  query: UseQueryResult<T, Error>;
  /** Content to show when data is loaded successfully */
  children: ReactNode;
  /** Custom loading message */
  loadingMessage?: string;
  /** Custom error message */
  errorMessage?: string;
  /** Custom empty state component */
  emptyState?: ReactNode;
  /** Default empty state message */
  emptyMessage?: string;
  /** Container wrapper - often a Card */
  wrapper?: (children: ReactNode) => ReactNode;
  /** Height to maintain during loading/error states */
  height?: string;
  /** Custom skeleton component for loading */
  skeleton?: ReactNode;
  /** Loading type - spinner or skeleton */
  loadingType?: 'spinner' | 'skeleton';
  /** Function to determine if the data is empty (defaults to checking if data exists) */
  isEmpty?: (data: T) => boolean;
}

/**
 * Specialized data loading wrapper for React Query responses
 */
export function QueryLoading<T>({
  query,
  children,
  loadingMessage,
  errorMessage,
  emptyState,
  emptyMessage = 'No data available',
  wrapper,
  height,
  skeleton,
  loadingType = 'skeleton',
  isEmpty,
}: QueryLoadingProps<T>) {
  // Default empty check - can be overridden via isEmpty prop
  const defaultIsEmpty = (data: T): boolean => {
    if (!data) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object' && 'data' in data) {
      const nestedData = (data as { data: unknown }).data;
      if (Array.isArray(nestedData)) return nestedData.length === 0;
    }
    return false;
  };

  const checkIsEmpty = isEmpty || defaultIsEmpty;
  const hasData = query.data ? !checkIsEmpty(query.data) : false;

  return (
    <DataLoading
      isLoading={query.isLoading}
      error={query.error}
      hasData={hasData}
      loadingMessage={loadingMessage}
      errorMessage={errorMessage}
      emptyState={emptyState}
      emptyMessage={emptyMessage}
      onRetry={query.refetch}
      wrapper={wrapper}
      height={height}
      skeleton={skeleton}
      loadingType={loadingType}
    >
      {children}
    </DataLoading>
  );
}
