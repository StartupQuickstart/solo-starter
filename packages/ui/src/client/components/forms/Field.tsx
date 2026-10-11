'use client';

import { Slot } from '@radix-ui/react-slot';
import { useId, useMemo, type ReactNode } from 'react';

import { Label } from '@/client/components/ui/label';
import { cn } from '@/shared/lib/utils';

import { FieldControlContext, type FieldControlProps } from './field-context';

export interface FieldProps {
  readonly label: string;
  /** One control: an Input, Textarea, Select, DatePicker, Combobox... */
  readonly children: ReactNode;
  /** A line under the control saying what to enter. */
  readonly help?: string | undefined;
  /** What is wrong with the value. Shown in place of nothing, announced, and marks the control invalid. */
  readonly error?: string | undefined;
  /** Adds "(optional)" after the label. Required is the default and is not marked. */
  readonly optional?: boolean;
  /** The control's id. Generated when omitted. */
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * A labelled form field: the label, one control, a help line and an error.
 *
 * It wires the accessibility attributes so screens do not: the label points at
 * the control, and the control is described by the help and the error and is
 * marked invalid when there is an error. Put exactly one control inside. A
 * Select goes in whole; its trigger picks the attributes up.
 *
 * @example
 * <Field label="Note name" help="Shown in lists and on the dashboard." error={errors.name}>
 *   <Input value={name} onChange={(e) => setName(e.target.value)} />
 * </Field>
 */
export function Field({ label, children, help, error, optional = false, id, className }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;
  const describedBy = [help ? helpId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;
  const invalid = error ? true : undefined;
  const control = useMemo<FieldControlProps>(
    () => ({ id: controlId, 'aria-describedby': describedBy, 'aria-invalid': invalid }),
    [controlId, describedBy, invalid],
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={controlId}>
        {label}
        {optional && <span className="text-muted-foreground font-normal">(optional)</span>}
      </Label>
      <FieldControlContext.Provider value={control}>
        <Slot {...control}>{children}</Slot>
      </FieldControlContext.Provider>
      {help && (
        <p id={helpId} className="text-muted-foreground text-xs">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
