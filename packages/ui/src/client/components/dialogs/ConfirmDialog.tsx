'use client';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/client/components/ui/alert-dialog';
import { Button } from '@/client/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
}

/**
 * Standard confirmation dialog component
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Delete Item"
 *   description="Are you sure you want to delete this item? This action cannot be undone."
 *   variant="danger"
 *   confirmLabel="Delete"
 *   isLoading={isDeleting}
 *   error={deleteError}
 *   onConfirm={handleDelete}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  error,
  onConfirm,
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: 'bg-red-600 text-white hover:bg-red-700',
    warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
    info: 'bg-blue-600 text-white hover:bg-blue-700',
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} className={variantStyles[variant]}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
