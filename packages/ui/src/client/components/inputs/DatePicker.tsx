'use client';

import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { cn } from '@/shared/lib/utils';

type InputPassThrough = Pick<ComponentProps<'input'>, 'id' | 'name' | 'disabled' | 'required' | 'aria-describedby' | 'aria-invalid'>;

export interface DatePickerProps extends InputPassThrough {
  /** The chosen day as `YYYY-MM-DD`, or `null` for none. */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  /** Earliest and latest selectable days, `YYYY-MM-DD`. */
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  /** Shows a button that clears the date. @default true */
  readonly clearable?: boolean;
  readonly className?: string | undefined;
}

/**
 * Picks a calendar day.
 *
 * It is the browser's own date control in the design system's clothes: the
 * calendar, the keyboard handling, the locale's day order and the phone
 * picker all come from the browser, which does them better than a custom
 * grid and needs no dependency. The value is always `YYYY-MM-DD`, whatever
 * the browser displays.
 */
export function DatePicker({ value, onChange, min, max, clearable = true, className, disabled, ...inputProps }: DatePickerProps) {
  const showClear = clearable && value !== null && !disabled;

  return (
    <div className={cn('relative w-full max-w-56', className)}>
      <Input
        type="date"
        value={value ?? ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className={cn('tabular-nums', showClear && 'pr-9')}
        {...inputProps}
      />
      {showClear && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-8 top-1/2 size-6 -translate-y-1/2 p-0"
          aria-label="Clear date"
          onClick={() => onChange(null)}
        >
          <X aria-hidden className="text-muted-foreground size-3.5" />
        </Button>
      )}
    </div>
  );
}
