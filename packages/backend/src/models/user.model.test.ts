import { describe, expect, it } from 'vitest';

import type { Backend } from '../index';
import { UserModel } from './user.model';

interface UserRow {
  id: string;
  clerkId: string;
  deletedAt: Date | null;
}

/** A user table that answers `findFirst` by matching every field of `where`. */
function backendWith(rows: UserRow[]): Backend<any> {
  const user = {
    findFirst: async ({ where }: { where: Partial<UserRow> }) =>
      rows.find((row) => Object.entries(where).every(([key, value]) => row[key as keyof UserRow] === value)) ?? null,
  };
  return { database: { client: { user } } } as unknown as Backend<any>;
}

describe('UserModel', () => {
  it('reads the user table, newest first, searchable by email and name', () => {
    const model = new UserModel(backendWith([]));

    expect(model.config.tableName).toBe('user');
    expect(model.config.searchFields).toEqual(['email', 'firstName', 'lastName']);
    expect(model.config.defaultOrderBy).toEqual({ createdAt: 'desc' });
  });

  it('finds a live user', async () => {
    const row = { id: 'usr_1', clerkId: 'clerk_1', deletedAt: null };

    expect(await new UserModel(backendWith([row])).findOne({ clerkId: 'clerk_1' })).toBe(row);
  });

  it('never finds a deleted user, so provisioning cannot bring an account back', async () => {
    const deleted = { id: 'usr_1', clerkId: 'clerk_1', deletedAt: new Date('2026-01-01T00:00:00.000Z') };
    const model = new UserModel(backendWith([deleted]));

    expect(await model.findOne({ clerkId: 'clerk_1' })).toBeNull();
    expect(await model.findById('usr_1')).toBeNull();
  });
});
