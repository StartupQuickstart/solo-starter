'use client';

import { Archive, Download, Trash2, X } from 'lucide-react';

import { Button } from '@/client/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onExport?: () => void;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onDelete,
  onArchive,
  onExport,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'bg-card fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border p-4 shadow-lg',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{selectedCount} selected</span>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="bg-border h-4 w-px" />

      <div className="flex gap-1">
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
        )}
        {onArchive && (
          <Button variant="outline" size="sm" onClick={onArchive}>
            <Archive className="mr-2 size-4" />
            Archive
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
