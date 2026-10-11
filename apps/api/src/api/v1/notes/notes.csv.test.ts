import { describe, expect, it } from 'vitest';

import { notesCsvHeader, notesCsvRows } from './notes.csv';
import type { NoteRecord } from './notes.model';

const CREATED = new Date('2026-08-01T09:30:00.000Z');
const UPDATED = new Date('2026-08-02T10:00:00.000Z');

function note(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return { id: 'note_1', title: 'Title', body: 'Body', createdAt: CREATED, updatedAt: UPDATED, ...overrides };
}

describe('notesCsvHeader', () => {
  it('names the four columns', () => {
    expect(notesCsvHeader()).toBe('"title","body","createdAt","updatedAt"\r\n');
  });
});

describe('notesCsvRows', () => {
  it('writes one quoted line per note, with ISO dates and no id', () => {
    expect(notesCsvRows([note()])).toBe('"Title","Body","2026-08-01T09:30:00.000Z","2026-08-02T10:00:00.000Z"\r\n');
  });

  it('keeps the order it is given', () => {
    const csv = notesCsvRows([note({ title: 'First' }), note({ title: 'Second' })]);

    expect(csv.indexOf('First')).toBeLessThan(csv.indexOf('Second'));
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('doubles quotes and keeps commas and line breaks inside the cell', () => {
    const csv = notesCsvRows([note({ title: 'He said "hi", twice', body: 'line one\nline two' })]);

    expect(csv).toContain('"He said ""hi"", twice","line one\nline two",');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcell'])('stops a spreadsheet running %j as a formula', (value) => {
    expect(notesCsvRows([note({ title: value, body: 'plain' })])).toContain(`"'${value}","plain"`);
  });

  it('writes an empty body as an empty cell', () => {
    expect(notesCsvRows([note({ body: '' })])).toContain('"Title","",');
  });

  it('is empty for no notes', () => {
    expect(notesCsvRows([])).toBe('');
  });
});
