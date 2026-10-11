'use client';

import { createContext, useContext } from 'react';

/** What a Field gives the control inside it. */
export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
}

/**
 * The attributes of the enclosing Field, for a control whose focusable element
 * is not the Field's direct child. A Select is the case in point: the Field
 * wraps `<Select>`, which renders nothing itself, and the label has to reach
 * the trigger inside it.
 */
export const FieldControlContext = createContext<FieldControlProps | undefined>(undefined);

/** The enclosing Field's attributes, or `undefined` outside a Field. */
export function useFieldControl(): FieldControlProps | undefined {
  return useContext(FieldControlContext);
}
