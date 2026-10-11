interface TableSkeletonProps {
  /** Number of columns to display */
  columnCount?: number;
  /** Number of rows to display */
  rowCount?: number;
  /** Additional CSS classes */
  className?: string;
  /** Remove border and rounded corners */
  noBorder?: boolean;
}

/**
 * Skeleton loader for AG Grid tables
 * Shows animated placeholder structure matching AG Grid's appearance
 */
export function TableSkeleton({ columnCount = 5, rowCount = 8, className = '', noBorder = false }: TableSkeletonProps) {
  return (
    <div className={`h-full w-full overflow-hidden ${noBorder ? '' : 'rounded-lg border'} ${className}`}>
      {/* Header Row - matches AG Grid header styling */}
      <div className="bg-muted/20 flex h-12 items-center border-b">
        {[...Array(columnCount)].map((_, colIndex) => (
          <div
            key={colIndex}
            className="flex h-full flex-1 items-center border-r px-3 last:border-r-0"
            style={{ flex: 1 }}
          >
            <div
              className="bg-muted-foreground/30 h-4 w-3/4 animate-pulse rounded"
              style={{
                animationDelay: `${colIndex * 50}ms`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Body Rows - matches AG Grid row styling */}
      <div className="divide-y">
        {[...Array(rowCount)].map((_, rowIndex) => (
          <div key={rowIndex} className="hover:bg-muted/5 flex h-[52px] items-center">
            {[...Array(columnCount)].map((_, colIndex) => (
              <div
                key={colIndex}
                className="flex h-full flex-1 items-center border-r px-3 last:border-r-0"
                style={{ flex: 1 }}
              >
                <div
                  className="bg-muted-foreground/20 h-4 animate-pulse rounded"
                  style={{
                    width: `${Math.random() * 30 + 50}%`,
                    animationDelay: `${rowIndex * 100 + colIndex * 50}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
