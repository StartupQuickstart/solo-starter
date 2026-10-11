import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import type { AuthProvider, AuthenticatedUser } from './auth-provider';
import { autoProvisioningMiddleware } from './auto-provision';

interface UserRow {
  id: string;
  clerkId: string;
  email: string;
}

const CLERK_USER: AuthenticatedUser = {
  id: 'clerk_user_1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Example',
  imageUrl: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

/** Stands in for a unique-constraint violation from Prisma. */
function uniqueViolation(): Error & { code: string } {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

/** An in-memory user table with a unique Clerk id, like the real one. */
class FakeUserProvider {
  readonly rows: UserRow[] = [];
  /** Runs once, just before the next create: lets a test insert a competing row. */
  beforeCreate: (() => void) | undefined;
  failure: Error | undefined;

  async findOneWithContext(where: Partial<UserRow>): Promise<UserRow | null> {
    if (this.failure) throw this.failure;
    const entries = Object.entries(where);
    return this.rows.find((row) => entries.every(([key, value]) => row[key as keyof UserRow] === value)) ?? null;
  }

  async createWithContext(data: { clerkId: string; email: string }): Promise<UserRow> {
    const hook = this.beforeCreate;
    this.beforeCreate = undefined;
    hook?.();
    if (this.rows.some((row) => row.clerkId === data.clerkId)) throw uniqueViolation();
    const row = { id: `usr_${this.rows.length + 1}`, clerkId: data.clerkId, email: data.email };
    this.rows.push(row);
    return row;
  }

  async updateWithContext(id: string, data: Partial<UserRow>): Promise<UserRow> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error('No such user');
    Object.assign(row, data);
    return row;
  }
}

function authProviderFor(user: AuthenticatedUser | null): AuthProvider {
  return {
    getAuth: () => ({ userId: user?.id ?? null }),
    getUser: async () => user,
    requireAuth: () => (_req, _res, next) => next(),
  };
}

/** Runs the middleware for one request and reports what it did. */
async function run(users: FakeUserProvider, signedIn: AuthenticatedUser | null = CLERK_USER) {
  const req = {} as Request;
  const errors: unknown[] = [];
  let continued = false;
  const next: NextFunction = (error?: unknown) => {
    continued = true;
    if (error !== undefined) errors.push(error);
  };

  await autoProvisioningMiddleware(users, authProviderFor(signedIn))(req, {} as Response, next);
  return { req, errors, continued };
}

describe('autoProvisioningMiddleware', () => {
  it('creates the user on their first request and puts the row on the request', async () => {
    const users = new FakeUserProvider();

    const { req, errors } = await run(users);

    expect(errors).toEqual([]);
    expect(users.rows).toEqual([{ id: 'usr_1', clerkId: 'clerk_user_1', email: 'ada@example.com' }]);
    expect(req.provisioned).toEqual({ user: users.rows[0] });
  });

  it('uses the existing row on later requests', async () => {
    const users = new FakeUserProvider();
    await run(users);

    const { req } = await run(users);

    expect(users.rows).toHaveLength(1);
    expect(req.provisioned?.user).toBe(users.rows[0]);
  });

  it('provisions nothing, and continues, when nobody is signed in', async () => {
    const users = new FakeUserProvider();

    const { req, continued, errors } = await run(users, null);

    expect(continued).toBe(true);
    expect(errors).toEqual([]);
    expect(req.provisioned).toEqual({});
    expect(users.rows).toEqual([]);
  });

  it('never hands a row to someone because their email matches: a different Clerk id is a different person', async () => {
    const users = new FakeUserProvider();
    users.rows.push({ id: 'usr_other', clerkId: 'clerk_someone_else', email: 'ada@example.com' });

    const { req } = await run(users);

    // The other person's row is untouched, and the session gets a row of its own.
    expect(users.rows).toEqual([
      { id: 'usr_other', clerkId: 'clerk_someone_else', email: 'ada@example.com' },
      { id: 'usr_2', clerkId: 'clerk_user_1', email: 'ada@example.com' },
    ]);
    expect(req.provisioned?.user).toBe(users.rows[1]);
  });

  it('uses the row a concurrent request created first', async () => {
    const users = new FakeUserProvider();
    users.beforeCreate = () => {
      users.rows.push({ id: 'usr_winner', clerkId: 'clerk_user_1', email: 'ada@example.com' });
    };

    const { req, errors } = await run(users);

    expect(errors).toEqual([]);
    expect(users.rows).toHaveLength(1);
    expect(req.provisioned?.user).toEqual({ id: 'usr_winner', clerkId: 'clerk_user_1', email: 'ada@example.com' });
  });

  it('passes a database failure to the error handler', async () => {
    const users = new FakeUserProvider();
    users.failure = new Error('connection lost');

    const { errors, req } = await run(users);

    expect(errors).toEqual([users.failure]);
    expect(req.provisioned?.user).toBeUndefined();
  });

  it('starts every request with an empty provisioned object, whatever was set before', async () => {
    const req = { provisioned: { user: { id: 'usr_forged' } } } as Request;

    await autoProvisioningMiddleware(new FakeUserProvider(), authProviderFor(null))(req, {} as Response, () => undefined);

    expect(req.provisioned).toEqual({});
  });
});
