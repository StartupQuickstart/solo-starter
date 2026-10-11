'use client';

import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

import { Button } from '@/client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/client/components/ui/dialog';

/**
 * FormDialog - Reusable dialog with form submission handling
 *
 * Provides a consistent dialog pattern for forms with loading states,
 * error handling, and submit/cancel actions.
 *
 * @example
 * ```tsx
 * <FormDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Create note"
 *   description="Fill out the form to create a new note"
 *   onSubmit={handleSubmit}
 *   isLoading={mutation.isPending}
 *   error={mutation.error?.message}
 *   submitLabel="Create"
 * >
 *   <Input placeholder="Title" {...formProps} />
 * </FormDialog>
 * ```
 */

export interface FormDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Dialog title
   */
  title: string;

  /**
   * Dialog description (optional)
   */
  description?: string;

  /**
   * Form content (inputs, etc.)
   */
  children: ReactNode;

  /**
   * Form submit handler
   */
  onSubmit: (e: React.FormEvent) => void;

  /**
   * Whether the form is submitting
   * @default false
   */
  isLoading?: boolean;

  /**
   * Error message to display
   */
  error?: string | null;

  /**
   * Submit button label
   * @default "Submit"
   */
  submitLabel?: string;

  /**
   * Cancel button label
   * @default "Cancel"
   */
  cancelLabel?: string;

  /**
   * Trigger element (for DialogTrigger)
   */
  trigger?: ReactNode;

  /**
   * Hide footer
   * @default false
   */
  hideFooter?: boolean;

  /**
   * Custom footer content
   */
  footer?: ReactNode;

  /**
   * Disable submit button
   * @default false
   */
  disableSubmit?: boolean;

  /**
   * Dialog size
   * @default "default"
   */
  size?: 'sm' | 'default' | 'lg' | 'xl';
}

const sizeClassMap = {
  sm: 'sm:max-w-sm',
  default: 'sm:max-w-[425px]',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const;

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  isLoading = false,
  error,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  trigger,
  hideFooter = false,
  footer,
  disableSubmit = false,
  size = 'default',
}: FormDialogProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && !disableSubmit) {
      onSubmit(e);
    }
  };

  const dialogContent = (
    <DialogContent className={sizeClassMap[size]}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">{children}</div>

        {error && <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">{error}</div>}

        {!hideFooter && (
          <DialogFooter>
            {footer || (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                  {cancelLabel}
                </Button>
                <Button type="submit" disabled={isLoading || disableSubmit}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    submitLabel
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </form>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogContent}
    </Dialog>
  );
}

/**
 * Compound component exports for more flexible composition
 */
FormDialog.Header = DialogHeader;
FormDialog.Title = DialogTitle;
FormDialog.Description = DialogDescription;
FormDialog.Footer = DialogFooter;
