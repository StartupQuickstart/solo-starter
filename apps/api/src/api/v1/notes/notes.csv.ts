import type { NoteRecord } from './notes.model';

/**
 * Notes as CSV (RFC 4180): every field quoted, quotes doubled, CRLF line ends.
 * Pure; the controller writes the result to the response.
 */

const LINE_END = '\r\n';

/** The columns of the export, in order. */
export const NOTES_CSV_COLUMNS = ['title', 'body', 'createdAt', 'updatedAt'] as const;

/**
 * A cell that starts with one of these is run as a formula by spreadsheet
 * programs. Notes are free text, so such a cell is prefixed with a single
 * quote, which makes the program show it as text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function line(cells: readonly string[]): string {
  return `${cells.join(',')}${LINE_END}`;
}

/** The header line. */
export function notesCsvHeader(): string {
  return line(NOTES_CSV_COLUMNS.map(cell));
}

/**
 * One line per note. Dates are ISO 8601.
 *
 * @param notes - The notes to write, in the order they should appear.
 */
export function notesCsvRows(notes: readonly NoteRecord[]): string {
  return notes
    .map((note) =>
      line([cell(note.title), cell(note.body), cell(note.createdAt.toISOString()), cell(note.updatedAt.toISOString())]),
    )
    .join('');
}
