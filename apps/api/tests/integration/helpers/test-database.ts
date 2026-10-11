import type { PrismaClient } from '../../../generated/prisma';
import { createPrismaClient } from '../../../src/lib/database/prisma-client';

/** The database the integration tests may truncate. Unset: the tests that need it are skipped. */
export const DATABASE_URL_TEST = process.env['DATABASE_URL_TEST'];

/**
 * A Prisma client on the test database.
 *
 * @throws When DATABASE_URL_TEST is not set. Suites guard with
 *   `describe.skipIf(!DATABASE_URL_TEST)`, so this only runs when it is.
 */
export function connectToTestDatabase(): PrismaClient {
  if (!DATABASE_URL_TEST) throw new Error('DATABASE_URL_TEST is not set.');
  return createPrismaClient({ url: DATABASE_URL_TEST });
}
