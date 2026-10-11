/**
 * Toast Utilities
 *
 * Provides a consistent, standardized interface for toasts.
 * Wraps Sonner with pre-configured durations and styling.
 *
 * @example Basic usage
 * ```ts
 * import { toast } from '@app/ui';
 *
 * // Success
 * toast.success('Changes saved');
 *
 * // Error with description
 * toast.error('Failed to save', 'Please try again later');
 *
 * // Loading state
 * const id = toast.loading('Saving...');
 * // ... after operation completes
 * toast.dismiss(id);
 * toast.success('Saved!');
 * ```
 *
 * @requires Sonner's Toaster component must be rendered in your app.
 * @see https://sonner.emilkowal.ski/ for Sonner documentation
 */

import { toast as sonnerToast } from 'sonner';

export const toast = {
  /**
   * Show a success toast.
   * Use for confirming successful operations.
   *
   * @param message - Primary message to display
   * @param description - Optional secondary message with details
   * @returns Toast ID for programmatic control
   *
   * @example
   * toast.success('Profile updated');
   * toast.success('File uploaded', '3 files processed successfully');
   */
  success: (message: string, description?: string) => {
    return sonnerToast.success(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Show an error toast.
   * Use for operation failures or errors that need user attention.
   * Displays longer than other toasts to ensure visibility.
   *
   * @param message - Primary error message
   * @param description - Optional details about the error or recovery steps
   * @returns Toast ID for programmatic control
   *
   * @example
   * toast.error('Failed to save');
   * toast.error('Upload failed', 'File size exceeds 10MB limit');
   */
  error: (message: string, description?: string) => {
    return sonnerToast.error(message, {
      description,
      duration: 5000,
    });
  },

  /**
   * Show an informational toast.
   * Use for neutral information that doesn't indicate success or failure.
   *
   * @param message - Primary message to display
   * @param description - Optional additional details
   * @returns Toast ID for programmatic control
   *
   * @example
   * toast.info('New version available');
   * toast.info('Tip', 'Press Cmd+K to open command palette');
   */
  info: (message: string, description?: string) => {
    return sonnerToast.info(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Show a warning toast.
   * Use for non-critical issues or things the user should be aware of.
   *
   * @param message - Primary warning message
   * @param description - Optional details or recommended actions
   * @returns Toast ID for programmatic control
   *
   * @example
   * toast.warning('Low disk space');
   * toast.warning('Session expiring', 'You will be logged out in 5 minutes');
   */
  warning: (message: string, description?: string) => {
    return sonnerToast.warning(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Show a loading toast.
   * Use for indicating ongoing async operations.
   * Does not auto-dismiss - must be manually dismissed.
   *
   * @param message - Loading message to display
   * @param description - Optional additional context
   * @returns Toast ID - use this with dismiss() when operation completes
   *
   * @example
   * const toastId = toast.loading('Uploading files...');
   * try {
   *   await uploadFiles();
   *   toast.dismiss(toastId);
   *   toast.success('Upload complete');
   * } catch (error) {
   *   toast.dismiss(toastId);
   *   toast.error('Upload failed');
   * }
   */
  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
    });
  },

  /**
   * Dismiss a specific toast or all toasts.
   *
   * @param toastId - ID of toast to dismiss, or omit to dismiss all
   *
   * @example
   * // Dismiss specific toast
   * const id = toast.loading('Working...');
   * toast.dismiss(id);
   *
   * // Dismiss all toasts
   * toast.dismiss();
   */
  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },
};
