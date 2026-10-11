/**
 * Notes against a real Postgres: every route as a signed-out visitor, as the
 * owner and as another user.
 *
 * The rule under test is the whole access model of the application: a signed-in
 * user reads and changes their own rows and nobody else's. Someone else's note
 * answers 404, the same as one that does not exist, and never appears in a
 * list or an export.
 *
 * @module tests/integration/notes.integration.test
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import type { PrismaClient } from '../../generated/prisma';
import { NOTE_LIMITS } from '../../src/api/v1/notes/notes.constants';
import { SUBSCRIPTION_STATUS } from '../../src/lib/billing/subscription';
import { authHeader, seedUser, truncateAll, type SeedUser } from './helpers/seed';
import { buildTestApp } from './helpers/test-app';
import { connectToTestDatabase, DATABASE_URL_TEST } from './helpers/test-database';

const NOTES = '/api/v1/notes';
const EXPORT = `${NOTES}/export`;
const START = new Date('2026-08-01T10:00:00.000Z');
const ONE_MINUTE_MS = 60_000;

interface NoteBody {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

describe.skipIf(!DATABASE_URL_TEST)('Notes', () => {
  let prisma: PrismaClient;
  let owner: SeedUser;
  let other: SeedUser;
  let subscriber: SeedUser;
  let request: ReturnType<typeof supertest>;
  /** The clock every write reads. Tests move it by hand. */
  let clock: Date;

  const advance = (ms: number = ONE_MINUTE_MS) => {
    clock = new Date(clock.getTime() + ms);
  };

  /** Creates a note through the API and returns it as served. */
  const createNote = async (user: SeedUser, title: string, body?: string): Promise<NoteBody> => {
    const res = await request.post(NOTES).set(authHeader(user)).send({ title, body });
    expect(res.status).toBe(201);
    return res.body.data;
  };

  const storedNote = (id: string) => prisma.note.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    prisma = connectToTestDatabase();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    clock = START;
    owner = await seedUser(prisma);
    other = await seedUser(prisma);
    subscriber = await seedUser(prisma, { subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE });
    request = supertest(
      buildTestApp({ prisma, knownUsers: [owner, other, subscriber], overrides: { now: () => clock } }),
    );
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // Signed out
  // ---------------------------------------------------------------------------

  describe('a signed-out visitor', () => {
    it.each([
      ['GET', NOTES],
      ['POST', NOTES],
      ['GET', EXPORT],
      ['GET', `${NOTES}/note_any`],
      ['PATCH', `${NOTES}/note_any`],
      ['DELETE', `${NOTES}/note_any`],
    ] as const)('is refused %s %s with 401', async (method, url) => {
      const res = await request[method.toLowerCase() as Lowercase<typeof method>](url).send({ title: 'Anything' });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
    });

    it('cannot read, change or delete a note that exists, and creates nothing', async () => {
      const note = await createNote(owner, 'Mine');

      expect((await request.get(`${NOTES}/${note.id}`)).status).toBe(401);
      expect((await request.patch(`${NOTES}/${note.id}`).send({ title: 'Taken' })).status).toBe(401);
      expect((await request.delete(`${NOTES}/${note.id}`)).status).toBe(401);
      expect((await request.post(NOTES).send({ title: 'Anonymous' })).status).toBe(401);

      expect(await storedNote(note.id)).toMatchObject({ title: 'Mine', deletedAt: null });
      expect(await prisma.note.count()).toBe(1);
    });

    it('is refused with a token nobody was given', async () => {
      const res = await request.get(NOTES).set('Authorization', 'Bearer not-a-session-token');

      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // The owner
  // ---------------------------------------------------------------------------

  describe('the owner', () => {
    it('creates a note: 201, a note_ id, the trimmed title, an empty body and the clock’s time', async () => {
      const res = await request.post(NOTES).set(authHeader(owner)).send({ title: '  Shopping  ' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        success: true,
        data: {
          id: expect.stringMatching(/^note_/),
          title: 'Shopping',
          body: '',
          createdAt: START.toISOString(),
          updatedAt: START.toISOString(),
        },
      });
      expect(await storedNote(res.body.data.id)).toMatchObject({ userId: owner.id, deletedAt: null });
    });

    it('keeps the body as written', async () => {
      const note = await createNote(owner, 'List', '  milk\n  eggs\n');

      expect(note.body).toBe('  milk\n  eggs\n');
    });

    it('cannot create a note for someone else by naming them in the body', async () => {
      const res = await request
        .post(NOTES)
        .set(authHeader(owner))
        .send({ title: 'Planted', userId: other.id, id: 'note_chosen' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).not.toBe('note_chosen');
      expect((await storedNote(res.body.data.id)).userId).toBe(owner.id);
    });

    it.each([
      ['no title', {}],
      ['a blank title', { title: '   ' }],
      ['a title over 120 characters', { title: 't'.repeat(NOTE_LIMITS.titleMax + 1) }],
      ['a body over 5000 characters', { title: 'A', body: 'b'.repeat(NOTE_LIMITS.bodyMax + 1) }],
      ['a title that is not text', { title: 42 }],
    ])('is told 400 VALIDATION_ERROR for %s, and nothing is saved', async (_case, body) => {
      const res = await request.post(NOTES).set(authHeader(owner)).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
      expect(await prisma.note.count()).toBe(0);
    });

    it('lists their notes newest first, with pagination', async () => {
      const first = await createNote(owner, 'First');
      advance();
      const second = await createNote(owner, 'Second');
      advance();
      const third = await createNote(owner, 'Third');

      const res = await request.get(NOTES).set(authHeader(owner));

      expect(res.status).toBe(200);
      expect(res.body.data.map((note: NoteBody) => note.id)).toEqual([third.id, second.id, first.id]);
      expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
    });

    it('pages through the list with page and limit', async () => {
      const first = await createNote(owner, 'First');
      advance();
      const second = await createNote(owner, 'Second');
      advance();
      const third = await createNote(owner, 'Third');

      const pageOne = await request.get(NOTES).query({ limit: 2 }).set(authHeader(owner));
      const pageTwo = await request.get(NOTES).query({ limit: 2, page: 2 }).set(authHeader(owner));
      const pastTheEnd = await request.get(NOTES).query({ limit: 2, page: 3 }).set(authHeader(owner));

      expect(pageOne.body.data.map((note: NoteBody) => note.id)).toEqual([third.id, second.id]);
      expect(pageOne.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      expect(pageTwo.body.data.map((note: NoteBody) => note.id)).toEqual([first.id]);
      expect(pastTheEnd.body.data).toEqual([]);
    });

    it.each([{ limit: 0 }, { limit: 101 }, { limit: 'all' }, { page: 0 }])(
      'is told 400 VALIDATION_ERROR for the list query %o',
      async (query) => {
        const res = await request.get(NOTES).query(query).set(authHeader(owner));

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      },
    );

    it('accepts the largest page size', async () => {
      const res = await request.get(NOTES).query({ limit: NOTE_LIMITS.pageSizeMax }).set(authHeader(owner));

      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(100);
    });

    it('reads one note', async () => {
      const note = await createNote(owner, 'Read me', 'Body');

      const res = await request.get(`${NOTES}/${note.id}`).set(authHeader(owner));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: note });
    });

    it('is told 404 NOT_FOUND for a note that does not exist', async () => {
      const res = await request.get(`${NOTES}/note_does_not_exist`).set(authHeader(owner));

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('changes only the fields sent, and moves updatedAt but not createdAt', async () => {
      const note = await createNote(owner, 'Draft', 'Keep this');
      advance();

      const res = await request.patch(`${NOTES}/${note.id}`).set(authHeader(owner)).send({ title: ' Final ' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        id: note.id,
        title: 'Final',
        body: 'Keep this',
        createdAt: START.toISOString(),
        updatedAt: new Date(START.getTime() + ONE_MINUTE_MS).toISOString(),
      });
    });

    it('can empty the body', async () => {
      const note = await createNote(owner, 'Draft', 'Remove this');

      const res = await request.patch(`${NOTES}/${note.id}`).set(authHeader(owner)).send({ body: '' });

      expect(res.body.data).toMatchObject({ title: 'Draft', body: '' });
    });

    it.each([
      ['nothing to change', {}],
      ['a blank title', { title: ' ' }],
      ['a body over the limit', { body: 'b'.repeat(NOTE_LIMITS.bodyMax + 1) }],
    ])('is told 400 VALIDATION_ERROR for a change with %s, and the note stays as it was', async (_case, body) => {
      const note = await createNote(owner, 'Draft', 'Body');

      const res = await request.patch(`${NOTES}/${note.id}`).set(authHeader(owner)).send(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(await storedNote(note.id)).toMatchObject({ title: 'Draft', body: 'Body' });
    });

    it('is told 404 when changing a note that does not exist', async () => {
      const res = await request.patch(`${NOTES}/note_does_not_exist`).set(authHeader(owner)).send({ title: 'X' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('deletes a note softly: it is gone from every route and the row remains', async () => {
      const kept = await createNote(owner, 'Kept');
      const note = await createNote(owner, 'Gone');
      advance();

      const res = await request.delete(`${NOTES}/${note.id}`).set(authHeader(owner));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { deleted: true } });
      expect((await storedNote(note.id)).deletedAt).toEqual(new Date(START.getTime() + ONE_MINUTE_MS));

      expect((await request.get(`${NOTES}/${note.id}`).set(authHeader(owner))).status).toBe(404);
      expect((await request.patch(`${NOTES}/${note.id}`).set(authHeader(owner)).send({ title: 'Back' })).status).toBe(404);
      expect((await request.delete(`${NOTES}/${note.id}`).set(authHeader(owner))).status).toBe(404);
      const list = await request.get(NOTES).set(authHeader(owner));
      expect(list.body.data.map((listed: NoteBody) => listed.id)).toEqual([kept.id]);
      expect(list.body.pagination.total).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Another user
  // ---------------------------------------------------------------------------

  describe('another signed-in user', () => {
    let ownersNote: NoteBody;

    beforeEach(async () => {
      ownersNote = await createNote(owner, 'Private', 'For my eyes only');
    });

    it('is told 404, not 403, when reading the owner’s note', async () => {
      const res = await request.get(`${NOTES}/${ownersNote.id}`).set(authHeader(other));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, code: 'NOT_FOUND', message: 'Note not found' });
    });

    it('gets the same answer as for a note that does not exist, so ids cannot be probed', async () => {
      const theirs = await request.get(`${NOTES}/${ownersNote.id}`).set(authHeader(other));
      const nobodys = await request.get(`${NOTES}/note_does_not_exist`).set(authHeader(other));

      expect(theirs.status).toBe(nobodys.status);
      expect(theirs.body).toEqual(nobodys.body);
    });

    it('is told 404 when changing the owner’s note, and it stays as it was', async () => {
      advance();

      const res = await request.patch(`${NOTES}/${ownersNote.id}`).set(authHeader(other)).send({ title: 'Defaced' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(await storedNote(ownersNote.id)).toMatchObject({
        title: 'Private',
        body: 'For my eyes only',
        updatedAt: START,
      });
    });

    it('is told 404 when deleting the owner’s note, and it is not deleted', async () => {
      const res = await request.delete(`${NOTES}/${ownersNote.id}`).set(authHeader(other));

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect((await storedNote(ownersNote.id)).deletedAt).toBeNull();
      expect((await request.get(`${NOTES}/${ownersNote.id}`).set(authHeader(owner))).status).toBe(200);
    });

    it('never sees the owner’s notes in their list, on any page', async () => {
      const mine = await createNote(other, 'My own');

      const list = await request.get(NOTES).set(authHeader(other));
      const everything = await request.get(NOTES).query({ limit: NOTE_LIMITS.pageSizeMax }).set(authHeader(other));

      expect(list.body.data.map((note: NoteBody) => note.id)).toEqual([mine.id]);
      expect(list.body.pagination.total).toBe(1);
      expect(JSON.stringify(everything.body)).not.toContain(ownersNote.id);
      expect(JSON.stringify(everything.body)).not.toContain('For my eyes only');
    });

    it('has an empty list while they have written nothing', async () => {
      const res = await request.get(NOTES).set(authHeader(other));

      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
    });

    it('never gets the owner’s notes in an export, even as a subscriber', async () => {
      await createNote(subscriber, 'Subscriber note');

      const res = await request.get(EXPORT).set(authHeader(subscriber));

      expect(res.status).toBe(200);
      expect(res.text).toContain('Subscriber note');
      expect(res.text).not.toContain('Private');
      expect(res.text).not.toContain('For my eyes only');
    });

    it('creates notes of their own, which the owner in turn cannot reach', async () => {
      const theirs = await createNote(other, 'Theirs');

      expect((await request.get(`${NOTES}/${theirs.id}`).set(authHeader(owner))).status).toBe(404);
      expect((await request.patch(`${NOTES}/${theirs.id}`).set(authHeader(owner)).send({ title: 'X' })).status).toBe(404);
      expect((await request.delete(`${NOTES}/${theirs.id}`).set(authHeader(owner))).status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // The gated feature: export as CSV
  // ---------------------------------------------------------------------------

  describe('GET /notes/export', () => {
    it('refuses a signed-out visitor with 401', async () => {
      const res = await request.get(EXPORT);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('refuses a user who is not subscribed with 403 SUBSCRIPTION_REQUIRED', async () => {
      await createNote(owner, 'Locked in');

      const res = await request.get(EXPORT).set(authHeader(owner));

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'This needs a subscription.',
      });
      expect(JSON.stringify(res.body)).not.toContain('Locked in');
    });

    it.each([SUBSCRIPTION_STATUS.CANCELED, SUBSCRIPTION_STATUS.UNPAID, SUBSCRIPTION_STATUS.INCOMPLETE])(
      'refuses a user whose subscription is %s',
      async (subscriptionStatus) => {
        await prisma.user.update({ where: { id: owner.id }, data: { subscriptionStatus } });

        expect((await request.get(EXPORT).set(authHeader(owner))).status).toBe(403);
      },
    );

    it.each([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.PAST_DUE])(
      'lets a user whose subscription is %s through',
      async (subscriptionStatus) => {
        await prisma.user.update({ where: { id: owner.id }, data: { subscriptionStatus } });

        expect((await request.get(EXPORT).set(authHeader(owner))).status).toBe(200);
      },
    );

    it('sends a subscriber their notes as a CSV attachment, newest first, without deleted ones', async () => {
      await createNote(subscriber, 'Older', 'first body');
      advance();
      const deleted = await createNote(subscriber, 'Deleted');
      advance();
      await createNote(subscriber, 'Newer, with a "quote"', 'two\nlines');
      await request.delete(`${NOTES}/${deleted.id}`).set(authHeader(subscriber));

      const res = await request.get(EXPORT).set(authHeader(subscriber));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe('attachment; filename="notes.csv"');
      expect(res.text).toBe(
        [
          '"title","body","createdAt","updatedAt"',
          '"Newer, with a ""quote""","two\nlines","2026-08-01T10:02:00.000Z","2026-08-01T10:02:00.000Z"',
          '"Older","first body","2026-08-01T10:00:00.000Z","2026-08-01T10:00:00.000Z"',
          '',
        ].join('\r\n'),
      );
    });

    it('sends only the header line to a subscriber with no notes', async () => {
      const res = await request.get(EXPORT).set(authHeader(subscriber));

      expect(res.status).toBe(200);
      expect(res.text).toBe('"title","body","createdAt","updatedAt"\r\n');
    });

    it('exports every note once when there are more than one batch, including notes created at the same moment', async () => {
      const count = NOTE_LIMITS.exportBatchSize * 2 + 3;
      await prisma.note.createMany({
        data: Array.from({ length: count }, (_unused, index) => ({
          userId: subscriber.id,
          title: `Note ${index}`,
          // Pairs of notes share a creation time, so a batch boundary falls between two of them.
          createdAt: new Date(START.getTime() + Math.floor(index / 2)),
          updatedAt: START,
        })),
      });

      const res = await request.get(EXPORT).set(authHeader(subscriber));

      const titles = res.text
        .split('\r\n')
        .slice(1, -1)
        .map((line) => line.split(',')[0]);
      expect(titles).toHaveLength(count);
      expect(new Set(titles).size).toBe(count);
    });
  });
});
