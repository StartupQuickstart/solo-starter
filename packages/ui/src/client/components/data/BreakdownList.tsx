import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import { STATUS_TONE, TONE_FILL, TONE_ICON, type StatusTone } from './status-tone';

export interface BreakdownItem {
  readonly label: string;
  readonly value: number;
  /** @default 'neutral' */
  readonly tone?: StatusTone;
  /** Shown before the label. With the label, it means the row is never read by colour alone. */
  readonly icon?: LucideIcon;
}

export interface BreakdownListProps {
  /** Names the list for assistive technology: "Open notes by due date". */
  readonly label: string;
  readonly items: readonly BreakdownItem[];
  readonly className?: string;
}

const PERCENT = 100;
const numbers = new Intl.NumberFormat('en-US');

/**
 * A few named amounts, each with a bar showing its share of the total: a
 * breakdown small enough to read as a list.
 */
export function BreakdownList({ label, items, className }: BreakdownListProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <ul aria-label={label} className={cn('space-y-4', className)}>
      {items.map((item) => {
        const tone = item.tone ?? STATUS_TONE.neutral;
        const Icon = item.icon;
        const share = total === 0 ? 0 : (item.value / total) * PERCENT;
        return (
          <li key={item.label}>
            <div className="flex items-center gap-2 text-sm">
              {Icon && <Icon aria-hidden className={cn('size-4 shrink-0', TONE_ICON[tone])} strokeWidth={1.75} />}
              <span className="flex-1">{item.label}</span>
              <span className="font-semibold tabular-nums">{numbers.format(item.value)}</span>
            </div>
            <div aria-hidden className="bg-secondary mt-2 h-1.5 overflow-hidden rounded-full">
              <div className={cn('h-full rounded-full transition-[width] duration-300 ease-out', TONE_FILL[tone])} style={{ width: `${share}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
