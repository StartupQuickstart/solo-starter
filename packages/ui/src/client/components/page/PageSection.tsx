import { type ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

export interface PageSectionProps {
  children: ReactNode;
  /**
   * Section variant that controls vertical padding
   * - header: pt-6 (top padding for page headers)
   * - content: pt-2 pb-6 (reduced top padding, bottom padding for content areas)
   * - default: py-4 (balanced vertical padding)
   */
  variant?: 'header' | 'content' | 'default';
  /**
   * Make this section a flex container that grows to fill available space.
   * Use for sections containing tables or other components that need to expand vertically.
   */
  flex?: boolean;
  /**
   * Add a top border separator
   */
  separator?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * PageSection - Standardized section wrapper for page content
 *
 * Provides consistent horizontal padding (px-6) and variant-based vertical padding.
 * Use this component to wrap sections within a PageWrapper to maintain consistent spacing.
 *
 * @example
 * // Header section with top padding
 * <PageSection variant="header">
 *   <PageHeader>
 *     <PageTitle>Title</PageTitle>
 *   </PageHeader>
 * </PageSection>
 *
 * @example
 * // Content section with reduced top padding and bottom padding
 * <PageSection variant="content">
 *   <Table>...</Table>
 * </PageSection>
 *
 * @example
 * // Content section with flex layout for tables
 * <PageSection variant="content" flex>
 *   <Table>...</Table>
 * </PageSection>
 *
 * @example
 * // With separator (like onboarding view)
 * <PageSection separator>
 *   <SectionTitle>Additional Content</SectionTitle>
 * </PageSection>
 */
export function PageSection({
  children,
  variant = 'default',
  flex = false,
  separator = false,
  className,
}: PageSectionProps) {
  return (
    <div
      className={cn(
        'px-4 sm:px-8',
        {
          'pt-7 sm:pt-9': variant === 'header',
          'pb-10 pt-5': variant === 'content',
          'py-4': variant === 'default',
          'border-t': separator,
          'flex flex-1 flex-col': flex,
        },
        className
      )}
    >
      {children}
    </div>
  );
}
