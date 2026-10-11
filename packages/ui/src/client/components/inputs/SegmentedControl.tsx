'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '@/shared/lib/utils';

export interface SegmentedOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export interface SegmentedControlProps<Value extends string> {
  /** Names the choice for assistive technology: "Date range". */
  readonly label: string;
  readonly options: readonly SegmentedOption<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  /** @default 'md' */
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/**
 * Two to four options that switch what the page shows, all visible at once:
 * a date range, a view. It is a radio group, so the arrow keys move through
 * it. For a choice that is saved with a form, use RadioGroup.
 */
export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<Value>) {
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      orientation="horizontal"
      value={value}
      onValueChange={(next) => {
        const chosen = options.find((option) => option.value === next);
        if (chosen) onChange(chosen.value);
      }}
      className={cn('bg-secondary inline-flex items-center rounded-lg p-1', className)}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-md font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px]',
            'data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-xs',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
          )}
        >
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
