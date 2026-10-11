'use client';

import { MoreHorizontal, type LucideIcon } from 'lucide-react';

import { Button } from '@/client/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';

export interface RowAction {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly onSelect: () => void;
  /** Destructive actions render last, in red, after a separator. */
  readonly destructive?: boolean;
  readonly disabled?: boolean;
}

export interface RowActionMenuProps {
  /** Names the row for assistive tech: the trigger reads "Actions for {label}". */
  readonly label: string;
  readonly actions: readonly RowAction[];
}

/**
 * RowActionMenu - the "⋯" menu at the end of a table row. Keeps secondary and
 * destructive actions out of the row so the table stays scannable.
 */
export function RowActionMenu({ label, actions }: RowActionMenuProps) {
  const safe = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  const renderItem = ({ label: itemLabel, icon: Icon, onSelect, destructive: isDestructive, disabled }: RowAction) => (
    <DropdownMenuItem
      key={itemLabel}
      onSelect={onSelect}
      disabled={disabled}
      className={isDestructive ? 'text-destructive focus:text-destructive' : undefined}
    >
      {Icon && <Icon className="mr-2 size-4" aria-hidden />}
      {itemLabel}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground size-8 p-0">
          <MoreHorizontal className="size-4" aria-hidden />
          <span className="sr-only">Actions for {label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {safe.map(renderItem)}
        {safe.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
