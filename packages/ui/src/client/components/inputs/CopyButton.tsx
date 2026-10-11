'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/client/components/ui/button';
import { cn } from '@/shared/lib/utils';

/** How long the button says "Copied" before it offers to copy again. */
const COPIED_FEEDBACK_MS = 2000;

export interface CopyButtonProps {
  /** The text to put on the clipboard. */
  readonly value: string;
  /** What is being copied, for the accessible name: "Copy API key". @default 'Copy' */
  readonly label?: string;
  /** Show the label beside the icon. Icon only by default. */
  readonly showLabel?: boolean;
  /** Writes to the clipboard. Injected in tests; the browser's clipboard by default. */
  readonly writeText?: (text: string) => Promise<void>;
  readonly className?: string | undefined;
}

const writeToClipboard = (text: string) => navigator.clipboard.writeText(text);

/**
 * Copies a value (an id, a key, a snippet) and confirms that it did, both
 * visibly and to screen readers.
 */
export function CopyButton({ value, label = 'Copy', showLabel = false, writeText = writeToClipboard, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The pending "back to Copy" timer must not fire after the button is gone.
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await writeText(value);
    } catch {
      // The browser refused (no permission, or not a secure page): say nothing false.
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? 'sm' : 'icon-sm'}
      onClick={() => void copy()}
      aria-label={showLabel ? undefined : label}
      className={cn('text-muted-foreground hover:text-foreground', className)}
    >
      <Icon aria-hidden className="size-4" />
      {showLabel && <span>{copied ? 'Copied' : label}</span>}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </Button>
  );
}
