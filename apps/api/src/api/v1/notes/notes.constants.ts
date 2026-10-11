/**
 * Notes: the example table. Constants shared by the schemas, the model, the
 * controller and the tests.
 */

export const NOTE_LIMITS = {
  titleMax: 120,
  bodyMax: 5000,
  pageSizeDefault: 20,
  pageSizeMax: 100,
  /** How many notes the export reads from the database at a time. */
  exportBatchSize: 500,
} as const;

export const NOTE_MESSAGE = {
  notFound: 'Note not found',
} as const;

/** The file `GET /notes/export` answers with. */
export const NOTES_EXPORT = {
  filename: 'notes.csv',
  contentType: 'text/csv; charset=utf-8',
} as const;

/** The export may be asked for a few times a minute: each one reads every note the user has. */
export const NOTES_EXPORT_RATE_LIMIT = { limit: 10, windowMs: 60 * 1000 } as const;
