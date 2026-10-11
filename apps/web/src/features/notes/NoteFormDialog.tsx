'use client';

import { Field, FormDialog, Input, Textarea } from '@app/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { NOTE_LIMITS, noteInputSchema, type Note, type NoteInput } from './note-model';
import { useCreateNote, useUpdateNote } from './useNotes';

export interface NoteFormDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The note to edit. Omit to create one. */
  readonly note?: Note | undefined;
}

type FieldErrors = Partial<Record<keyof NoteInput, string>>;

/**
 * EXAMPLE: notes. Create or edit a note, in a dialog over the list. The form
 * is the pattern for any small form in the app: Field for every control,
 * validation on submit with the message under the field it belongs to, the
 * save button busy while the request runs, and a toast when it is done.
 */
export function NoteFormDialog({ open, onOpenChange, note }: NoteFormDialogProps) {
  // Keyed by what is being edited, so reopening for another note starts clean.
  return <NoteForm key={`${note?.id ?? 'new'}-${String(open)}`} open={open} onOpenChange={onOpenChange} note={note} />;
}

function NoteForm({ open, onOpenChange, note }: NoteFormDialogProps) {
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const [values, setValues] = useState<NoteInput>({ title: note?.title ?? '', body: note?.body ?? '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  const isEdit = note !== undefined;
  const isSaving = createNote.isPending || updateNote.isPending;

  const set = (key: keyof NoteInput, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setFormError(undefined);
    const parsed = noteInputSchema.safeParse(values);
    if (!parsed.success) {
      const { fieldErrors: problems } = z.flattenError(parsed.error);
      setFieldErrors({ title: problems.title?.[0], body: problems.body?.[0] });
      return;
    }
    setFieldErrors({});

    try {
      if (isEdit) {
        await updateNote.mutateAsync({ noteId: note.id, input: parsed.data });
        toast.success('Note saved');
      } else {
        await createNote.mutateAsync(parsed.data);
        toast.success(`${parsed.data.title} created`);
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The note could not be saved.');
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit note' : 'New note'}
      description={isEdit ? 'Change the title or the text.' : 'A title and some text. Only you can see it.'}
      onSubmit={() => void submit()}
      isLoading={isSaving}
      error={formError}
      submitLabel={isEdit ? 'Save changes' : 'Create note'}
      size="lg"
    >
      <Field label="Title" error={fieldErrors.title}>
        <Input
          value={values.title}
          placeholder="For example, Ideas for the launch"
          maxLength={NOTE_LIMITS.titleMax}
          autoComplete="off"
          onChange={(event) => set('title', event.target.value)}
        />
      </Field>

      <Field label="Note" optional error={fieldErrors.body}>
        <Textarea
          rows={8}
          className="bg-card"
          value={values.body}
          maxLength={NOTE_LIMITS.bodyMax}
          onChange={(event) => set('body', event.target.value)}
        />
      </Field>
    </FormDialog>
  );
}
