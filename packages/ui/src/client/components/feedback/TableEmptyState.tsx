import { AlertCircle, Database, FilterX, SearchX } from 'lucide-react';
import { ReactNode } from 'react';

import { Button } from '@/client/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface TableEmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

export interface TableEmptyStateProps {
  /**
   * Visual variant of the empty state
   * - empty: No data created yet (default)
   * - search: Search query returned no results
   * - filter: Active filters hiding all data
   * - error: Data failed to load
   */
  variant?: 'empty' | 'search' | 'filter' | 'error';

  /**
   * Title text (auto-generated if not provided)
   */
  title?: string;

  /**
   * Description text (auto-generated if not provided)
   */
  description?: string;

  /**
   * Custom icon (uses variant default if not provided)
   */
  icon?: ReactNode;

  /**
   * Primary call-to-action button
   */
  primaryAction?: TableEmptyStateAction;

  /**
   * Secondary action button (shown as outline variant)
   */
  secondaryAction?: TableEmptyStateAction;

  /**
   * Size of the empty state
   * @default "md"
   */
  size?: 'md' | 'lg';

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Remove border and background (for use inside tables)
   * @default false
   */
  noBorder?: boolean;
}

const variantConfig = {
  empty: {
    icon: Database,
    title: 'No data yet',
    description: 'Get started by creating your first item',
    iconColor: 'text-primary/40',
  },
  search: {
    icon: SearchX,
    title: 'No results found',
    description: "Try adjusting your search query to find what you're looking for",
    iconColor: 'text-muted-foreground/60',
  },
  filter: {
    icon: FilterX,
    title: 'No matches found',
    description: 'Try adjusting or clearing your filters to see more results',
    iconColor: 'text-muted-foreground/60',
  },
  error: {
    icon: AlertCircle,
    title: 'Failed to load data',
    description: 'There was a problem loading the data. Please try again',
    iconColor: 'text-destructive/60',
  },
} as const;

export function TableEmptyState({
  variant = 'empty',
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  size = 'md',
  className,
  noBorder = false,
}: TableEmptyStateProps) {
  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const iconSize = size === 'lg' ? 'h-20 w-20' : 'h-16 w-16';
  const titleSize = size === 'lg' ? 'text-xl' : 'text-lg';
  const padding = size === 'lg' ? 'p-16' : 'p-12';
  const minHeight = size === 'lg' ? 'min-h-[500px]' : 'min-h-[400px]';

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center',
        !noBorder && 'bg-primary/[0.02] border-border/50 rounded-lg border',
        !noBorder && minHeight,
        !noBorder && padding,
        noBorder && 'py-16',
        className
      )}
    >
      {/* Icon */}
      <div className="mb-6">
        {icon ?? <IconComponent className={cn(iconSize, config.iconColor)} strokeWidth={1.5} />}
      </div>

      {/* Title */}
      <h3 className={cn('text-foreground mb-2 font-semibold', titleSize)}>{title ?? config.title}</h3>

      {/* Description */}
      <p className="text-muted-foreground mb-8 max-w-md text-center text-sm">{description ?? config.description}</p>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3">
          {primaryAction && (
            <Button onClick={primaryAction.onClick} size="default" className="gap-2">
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}

          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline" size="default">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
