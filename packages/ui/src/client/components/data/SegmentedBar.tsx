'use client';

import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import { STATUS_TONE, TONE_FILL, type StatusTone } from './status-tone';

export const SEGMENTED_BAR_SIZE = { sm: 'sm', md: 'md' } as const;
export type SegmentedBarSize = (typeof SEGMENTED_BAR_SIZE)[keyof typeof SEGMENTED_BAR_SIZE];

const TRACK_HEIGHT: Readonly<Record<SegmentedBarSize, string>> = { sm: 'h-1.5', md: 'h-2.5' };
const LEGEND_TEXT: Readonly<Record<SegmentedBarSize, string>> = { sm: 'text-xs', md: 'text-sm' };

export interface SegmentedBarItem {
  /** Unique within the bar. Reported by `onSelect`. */
  readonly id: string;
  readonly label: string;
  readonly value: number;
  /** @default 'neutral' */
  readonly tone?: StatusTone;
}

export interface SegmentedBarProps {
  /** Names the legend for assistive technology: "Notes by status". */
  readonly label: string;
  readonly items: readonly SegmentedBarItem[];
  /** The id of the part that is picked out. The others are dimmed. */
  readonly selected?: string | undefined;
  /**
   * Makes each legend entry a toggle. Called with the entry's id, or with
   * `undefined` when the selected entry is pressed again.
   */
  readonly onSelect?: ((id: string | undefined) => void) | undefined;
  /** @default 'md' */
  readonly size?: SegmentedBarSize;
  /** Shown at the end of the legend: a note, a link. */
  readonly trailing?: ReactNode;
  readonly className?: string;
}

const numbers = new Intl.NumberFormat('en-US');

/**
 * One bar split into parts of a whole, with a legend that writes every part
 * out as a name and a number. For a handful of parts that add up to something
 * (notes by status, seats by plan).
 *
 * With `onSelect`, the legend doubles as a filter: each entry is a toggle
 * button, and the selected part stays lit while the others dim.
 */
export function SegmentedBar({ label, items, selected, onSelect, size = SEGMENTED_BAR_SIZE.md, trailing, className }: SegmentedBarProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const hasSelection = selected !== undefined && items.some((item) => item.id === selected);

  return (
    <div className={cn('min-w-0', className)}>
      <div aria-hidden className={cn('bg-secondary flex gap-0.5 overflow-hidden rounded-full', TRACK_HEIGHT[size])}>
        {total > 0 &&
          items
            .filter((item) => item.value > 0)
            .map((item) => (
              <div
                key={item.id}
                data-segment={item.id}
                className={cn(
                  'h-full min-w-1 transition-[flex-grow,opacity] duration-300 ease-out',
                  TONE_FILL[item.tone ?? STATUS_TONE.neutral],
                  hasSelection && item.id !== selected && 'opacity-25',
                )}
                style={{ flexGrow: item.value, flexBasis: 0 }}
              />
            ))}
      </div>

      <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2', LEGEND_TEXT[size])}>
        <ul aria-label={label} className="-mx-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {items.map((item) => {
            const isSelected = hasSelection && item.id === selected;
            const entry = (
              <>
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', TONE_FILL[item.tone ?? STATUS_TONE.neutral])} />
                <span className={cn(isSelected ? 'text-foreground font-medium' : 'text-muted-foreground')}>{item.label}</span>
                <span className="text-foreground font-semibold tabular-nums">{numbers.format(item.value)}</span>
              </>
            );
            return (
              <li key={item.id}>
                {onSelect ? (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${item.label}, ${numbers.format(item.value)}`}
                    onClick={() => onSelect(isSelected ? undefined : item.id)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors',
                      'hover:bg-foreground/[0.06] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                      isSelected && 'bg-foreground/[0.06]',
                    )}
                  >
                    {entry}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-1.5 py-1">{entry}</span>
                )}
              </li>
            );
          })}
        </ul>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </div>
  );
}
