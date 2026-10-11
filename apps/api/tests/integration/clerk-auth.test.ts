/**
 * The session check in front of every feature route.
 *
 * These tests use `stubAuthMiddleware` in place of Clerk: it accepts the
 * token of a seeded user and nothing else, which leaves `req.provisioned` as
 * the real Clerk middleware and user provisioning would. What is under test
 * is everything after that: the 401 for anyone without a session, what the
 * refusal gives away, and that a session opens the caller's own data only.
 *
 * @module tests/integration/clerk-auth.test
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import type { PrismaClient } from '../../generated/prisma';
import { authHeader, seedUser, truncateAll, type SeedUser } from './helpers/seed';
import { mintTestToken } from './helpers/stub-auth';
import { buildTestApp } from './helpers/test-app';
import { connectToTestDatabase, DATABASE_URL_TEST } from './helpers/test-database';

// EXAMPLE: notes. This file uses the notes routes as its sample of a protected feature: point it at one of yours.
const NOTES = '/api/v1/notes';
const BILLING = '/api/v1/billing';

describe('Session check: no session (no database needed)', () => {
  // No known users: every token is refused before a query could run.
  const request = supertest(buildTestApp({ prisma: {} as PrismaClient, knownUsers: [] }));

  it.each([
    ['no Authorization header', undefined],
    ['an empty Authorization header', ''],
    ['the wrong scheme', 'Basic dXNlcjpwYXNz'],
    ['a token that is not a token', 'Bearer not-a-jwt-at-all'],
    ['too few segments', 'Bearer a.b'],
    ['too many segments', 'Bearer a.b.c.d'],
    ['an unsigned token', `Bearer ${Buffer.from('{"alg":"none"}').toString('base64url')}.e30.`],
    ['a well-formed token nobody was given', `Bearer ${mintTestToken('usr_unknown', 'user_unknown')}`],
  ])('answers 401, never 500, for %s', async (_case, header) => {
    const call = request.get(NOTES);
    if (header !== undefined) call.set('Authorization', header);

    const res = await call;

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' });
  });

  it.each([
    ['get', NOTES],
    ['post', NOTES],
    // EXAMPLE: notes. The next three rows are routes of the example: list the routes of your own feature.
    ['get', `${NOTES}/export`],
    ['patch', `${NOTES}/note_any`],
    ['delete', `${NOTES}/note_any`],
    ['get', BILLING],
    ['post', `${BILLING}/checkout`],
    ['post', `${BILLING}/portal`],
  ] as const)('answers 401 to %s %s whatever the method', async (method, path) => {
    const res = await request[method](path).send({});

    expect(res.status).toBe(401);
  });

  it('gives nothing away in the refusal: no stack trace, file path or database detail', async () => {
    const res = await request.get(NOTES);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/at \w+\s*\(/); // stack trace lines
    expect(body).not.toMatch(/node_modules/);
    expect(body).not.toMatch(/\/Users\//); // filesystem paths
    expect(body).not.toMatch(/prisma/i);
    expect(body).not.toMatch(/postgresql:\/\//);
    expect(body).not.toMatch(/DATABASE_URL/);
  });
});

describe.skipIf(!DATABASE_URL_TEST)('Session check: signed in (with database)', () => {
  let prisma: PrismaClient;
  let user: SeedUser;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    prisma = connectToTestDatabase();
    await truncateAll(prisma);
    user = await seedUser(prisma);
    request = supertest(buildTestApp({ prisma, knownUsers: [user] }));
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await prisma.$disconnect();
  });

  it('opens the feature routes to a signed-in user', async () => {
    expect((await request.get(NOTES).set(authHeader(user))).status).toBe(200);
    expect((await request.get(BILLING).set(authHeader(user))).status).toBe(200);
  });

  it('still refuses the same routes without the token', async () => {
    expect((await request.get(NOTES)).status).toBe(401);
    expect((await request.get(BILLING)).status).toBe(401);
  });

  it('shows a session with no user row nothing, rather than someone else’s data', async () => {
    // EXAMPLE: notes. Creates a row through the example, then lists it: send what your own create route takes.
    await request.post(NOTES).set(authHeader(user)).send({ title: 'Belongs to the seeded user' });
    const ghost: SeedUser = {
      id: 'usr_no_such_row',
      email: 'ghost@example.com',
      clerkId: 'user_ghost',
      token: mintTestToken('usr_no_such_row', 'user_ghost'),
    };
    const withGhost = supertest(buildTestApp({ prisma, knownUsers: [user, ghost] }));

    const notes = await withGhost.get(NOTES).set(authHeader(ghost));
    const billing = await withGhost.get(BILLING).set(authHeader(ghost));

    expect(notes.body.data).toEqual([]);
    expect(billing.status).toBe(404);
    expect(billing.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });
});
