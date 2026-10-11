import { z } from 'zod';

import { NOTE_LIMITS } from './notes.constants';

/** Notes: everything that crosses the HTTP boundary is parsed here. */

const titleSchema = z.string().trim().min(1, 'Give the note a title.').max(NOTE_LIMITS.titleMax);

/** The body is kept as written: leading and trailing space can be part of a note. */
const bodySchema = z.string().max(NOTE_LIMITS.bodyMax);

/** Body for `POST /notes`. */
export const createNoteSchema = z.object({
  title: titleSchema,
  body: bodySchema.default(''),
});

/** Body for `PATCH /notes/:noteId`. Only the fields present are changed. */
export const updateNoteSchema = z
  .object({
    title: titleSchema.optional(),
    body: bodySchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Send at least one field to change.',
  });

/** Query for `GET /notes`. */
export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(NOTE_LIMITS.pageSizeMax).default(NOTE_LIMITS.pageSizeDefault),
});

export const noteParamsSchema = z.object({ noteId: z.string().min(1) });

export type CreateNote = z.infer<typeof createNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
