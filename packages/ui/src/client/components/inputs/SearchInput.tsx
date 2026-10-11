'use client';

import { Search, X } from 'lucide-react';

import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { cn } from '@/shared/lib/utils';

/**
 * SearchInput - Standardized search input component
 *
 * A consistent search input with optional clear button and icon.
 * Used across the application for filtering and searching data.
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState('');
 *
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search notes..."
 * />
 * ```
 */

export interface SearchInputProps {
  /**
   * Current search value
   */
  value: string;

  /**
   * Callback when search value changes
   */
  onChange: (value: string) => void;

  /**
   * Placeholder text
   * @default "Search..."
   */
  placeholder?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show search icon
   * @default true
   */
  showIcon?: boolean;

  /**
   * Show clear button when value is not empty
   * @default true
   */
  showClear?: boolean;

  /**
   * Whether the input is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Callback when clear button is clicked
   */
  onClear?: () => void;

  /**
   * Accessible name for the input. Defaults to the placeholder, since a
   * placeholder alone is not a reliable label for assistive tech.
   */
  ariaLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  showIcon = true,
  showClear = true,
  disabled = false,
  onClear,
  ariaLabel,
}: SearchInputProps) {
  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div className={cn('relative w-full max-w-md', className)}>
      {showIcon && <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />}
      <Input
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn('h-9', showIcon && 'pl-9', showClear && value && 'pr-9')}
      />
      {showClear && value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 size-7 -translate-y-1/2 p-0 hover:bg-transparent"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="text-muted-foreground hover:text-foreground size-4" />
        </Button>
      )}
    </div>
  );
}
