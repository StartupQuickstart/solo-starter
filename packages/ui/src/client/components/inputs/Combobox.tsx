'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useId, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react';

import { Popover, PopoverAnchor, PopoverContent } from '@/client/components/ui/popover';
import { cn } from '@/shared/lib/utils';

export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
  /** A second line, such as an email address. Searched as well. */
  readonly description?: string | undefined;
}

type ControlPassThrough = Pick<ComponentProps<'input'>, 'id' | 'disabled' | 'aria-describedby' | 'aria-invalid'>;

export interface ComboboxProps extends ControlPassThrough {
  readonly options: readonly ComboboxOption[];
  /** The chosen option's value, or `null` for none. */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly placeholder?: string;
  /** Shown when nothing matches what was typed. */
  readonly emptyMessage?: string;
  /** Offers a first row that clears the choice, with this label. Omit to make a choice required. */
  readonly clearLabel?: string | undefined;
  readonly className?: string | undefined;
}

const KEY = { down: 'ArrowDown', up: 'ArrowUp', enter: 'Enter', escape: 'Escape', home: 'Home', end: 'End' } as const;

/** The value of the "clear the choice" row. Never a real option's value. */
const CLEAR_ROW = '\u0000clear';

/**
 * A select you can type into: for choosing one of many (a person, a customer,
 * a country). For a handful of fixed choices use Select, or a RadioGroup when
 * each choice needs explaining.
 *
 * Follows the ARIA combobox pattern: focus stays in the text box, the arrow
 * keys move through the list, Enter chooses, Escape closes.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyMessage = 'No matches.',
  clearLabel,
  className,
  id,
  disabled,
  ...ariaProps
}: ComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.value === value);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matching = term
      ? options.filter((option) => `${option.label} ${option.description ?? ''}`.toLowerCase().includes(term))
      : options;
    const clearRow: ComboboxOption[] = clearLabel && !term ? [{ value: CLEAR_ROW, label: clearLabel }] : [];
    return [...clearRow, ...matching];
  }, [options, query, clearLabel]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(0);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (option: ComboboxOption) => {
    onChange(option.value === CLEAR_ROW ? null : option.value);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (event.key === KEY.down || event.key === KEY.up) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const last = rows.length - 1;
    const moves: Partial<Record<string, number>> = {
      [KEY.down]: Math.min(activeIndex + 1, last),
      [KEY.up]: Math.max(activeIndex - 1, 0),
      [KEY.home]: 0,
      [KEY.end]: last,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setActiveIndex(next);
      return;
    }
    if (event.key === KEY.enter) {
      event.preventDefault();
      const active = rows[activeIndex];
      if (active) choose(active);
    } else if (event.key === KEY.escape) {
      event.preventDefault();
      close();
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <Popover open={open} onOpenChange={(next) => (next ? openList() : close())}>
      <PopoverAnchor asChild>
        <div className={cn('relative w-full', className)}>
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            type="text"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && rows.length > 0 ? optionId(activeIndex) : undefined}
            disabled={disabled}
            placeholder={selected ? selected.label : placeholder}
            // While closed the box shows the choice; while open, what is being typed.
            value={open ? query : (selected?.label ?? '')}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              if (!open) setOpen(true);
            }}
            onClick={openList}
            onKeyDown={onKeyDown}
            className={cn(
              'border-input shadow-xs placeholder:text-muted-foreground bg-card h-9 w-full rounded-md border py-1 pl-3 pr-9 text-sm outline-none transition-[color,box-shadow]',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
            )}
            {...ariaProps}
          />
          <ChevronsUpDown aria-hidden className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) max-h-64 overflow-auto p-1"
        // Focus stays in the text box: the list is driven from there.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (event.target === inputRef.current) event.preventDefault();
        }}
      >
        <ul id={listId} role="listbox" aria-label="Options">
          {rows.length === 0 && <li className="text-muted-foreground px-2 py-6 text-center text-sm">{emptyMessage}</li>}
          {rows.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                // Chosen on mouse down, before the text box loses focus.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  index === activeIndex && 'bg-accent text-accent-foreground',
                  option.value === CLEAR_ROW && 'text-muted-foreground',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description && <span className="text-muted-foreground block truncate text-xs">{option.description}</span>}
                </span>
                {isSelected && <Check aria-hidden className="size-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
