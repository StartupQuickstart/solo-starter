import { format, parseISO } from 'date-fns';
import { z } from 'zod';

/**
 * EXAMPLE: notes. The shapes the API serves and the rules the form applies.
 * Nothing here imports React.
 *
 * This folder is the example to copy for your own feature, and to delete when
 * you have one: search the app for "EXAMPLE: notes" to find every line outside
 * this folder that belongs to it.
 */

/** The same limits the API enforces (`POST /api/v1/notes`). */
export const NOTE_LIMITS = { titleMax: 120, bodyMax: 5000 } as const;

/** A note, as the API serves it. Parsed on arrival, so the screens trust the shape. */
export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Note = z.infer<typeof noteSchema>;

export const noteListSchema = z.array(noteSchema);

/** What `DELETE /api/v1/notes/:noteId` answers. */
export const noteDeletedSchema = z.object({ deleted: z.literal(true) });

/** What the create and edit form sends, with the message for each rule it can break. */
export const noteInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the note a title.')
    .max(NOTE_LIMITS.titleMax, `Keep the title under ${NOTE_LIMITS.titleMax} characters.`),
  body: z.string().max(NOTE_LIMITS.bodyMax, `Keep the note under ${NOTE_LIMITS.bodyMax} characters.`),
});

export type NoteInput = z.infer<typeof noteInputSchema>;

/** The API's code for "this needs a subscription" (`GET /api/v1/notes/export`). */
export const SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED';

/** The name the exported file is saved under. */
export const EXPORT_FILE_NAME = 'notes.csv';

/** `2026-06-02T09:00:00.000Z` -> "Jun 2, 2026", in the viewer's own time zone. */
export function formatNoteDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}
