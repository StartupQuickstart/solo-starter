import { describe, expect, it } from 'vitest';

import { NOTE_LIMITS } from './notes.constants';
import { createNoteSchema, listNotesQuerySchema, noteParamsSchema, updateNoteSchema } from './notes.schemas';

describe('createNoteSchema', () => {
  it('trims the title and gives a note without a body an empty one', () => {
    expect(createNoteSchema.parse({ title: '  Shopping ' })).toEqual({ title: 'Shopping', body: '' });
  });

  it('keeps the body exactly as written', () => {
    expect(createNoteSchema.parse({ title: 'A', body: '  indented\n' }).body).toBe('  indented\n');
  });

  it('accepts a title and a body at their limits', () => {
    const atLimit = { title: 't'.repeat(NOTE_LIMITS.titleMax), body: 'b'.repeat(NOTE_LIMITS.bodyMax) };

    expect(createNoteSchema.safeParse(atLimit).success).toBe(true);
  });

  it.each([
    ['no title', {}],
    ['a blank title', { title: '   ' }],
    ['a title over the limit', { title: 't'.repeat(NOTE_LIMITS.titleMax + 1) }],
    ['a body over the limit', { title: 'A', body: 'b'.repeat(NOTE_LIMITS.bodyMax + 1) }],
    ['a title that is not text', { title: 42 }],
    ['a body that is not text', { title: 'A', body: null }],
  ])('rejects %s', (_case, input) => {
    expect(createNoteSchema.safeParse(input).success).toBe(false);
  });

  it('drops fields a client must not set', () => {
    expect(createNoteSchema.parse({ title: 'A', userId: 'usr_other', id: 'note_chosen' })).toEqual({
      title: 'A',
      body: '',
    });
  });
});

describe('updateNoteSchema', () => {
  it('accepts either field by itself', () => {
    expect(updateNoteSchema.parse({ title: ' New ' })).toEqual({ title: 'New' });
    expect(updateNoteSchema.parse({ body: '' })).toEqual({ body: '' });
  });

  it('rejects a change that changes nothing', () => {
    expect(updateNoteSchema.safeParse({}).success).toBe(false);
    expect(updateNoteSchema.safeParse({ userId: 'usr_other' }).success).toBe(false);
  });

  it('rejects a blank title', () => {
    expect(updateNoteSchema.safeParse({ title: ' ' }).success).toBe(false);
  });
});

describe('listNotesQuerySchema', () => {
  it('defaults to the first page of twenty', () => {
    expect(listNotesQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('reads numbers from the query string', () => {
    expect(listNotesQuerySchema.parse({ page: '3', limit: '100' })).toEqual({ page: 3, limit: 100 });
  });

  it.each([{ limit: '0' }, { limit: '101' }, { limit: 'many' }, { page: '0' }, { page: '-1' }, { page: '1.5' }])(
    'rejects %o',
    (query) => {
      expect(listNotesQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});

describe('noteParamsSchema', () => {
  it('requires an id', () => {
    expect(noteParamsSchema.safeParse({ noteId: '' }).success).toBe(false);
    expect(noteParamsSchema.parse({ noteId: 'note_1' })).toEqual({ noteId: 'note_1' });
  });
});
