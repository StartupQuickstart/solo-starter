import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../../generated/prisma';

/** How the API connects to Postgres. */
export interface DatabaseConnection {
  /** A Postgres connection string. */
  readonly url: string;
  /** The most connections the pool opens. The driver's default when omitted. */
  readonly maxConnections?: number;
}

/**
 * Prisma connects through a driver adapter: the `pg` driver, with its own
 * connection pool. The pool size is set here, not in the connection string.
 */
function createAdapter({ url, maxConnections }: DatabaseConnection): PrismaPg {
  return new PrismaPg({
    connectionString: url,
    ...(maxConnections !== undefined ? { max: maxConnections } : {}),
  });
}

/**
 * Create a Prisma client for a database.
 *
 * @param connection - Where to connect, and how many connections to allow.
 * @returns A client; nothing is opened until the first query.
 */
export function createPrismaClient(connection: DatabaseConnection): PrismaClient {
  return new PrismaClient({ adapter: createAdapter(connection) });
}

/** Everything `PrismaClient` accepts at construction. */
type ClientOptions = NonNullable<ConstructorParameters<typeof PrismaClient>[0]>;

/** A class that constructs a client from the options a caller chooses to pass. */
export type BoundPrismaClientClass = new (options?: Partial<ClientOptions>) => PrismaClient;

/**
 * A `PrismaClient` class already bound to a database.
 *
 * `Backend.create` takes the client's class and constructs it itself, passing
 * only logging options. Prisma needs the adapter at construction, so the class
 * handed over carries it.
 *
 * @param connection - Where to connect, and how many connections to allow.
 * @returns A class whose instances connect to that database.
 */
export function boundPrismaClient(connection: DatabaseConnection): BoundPrismaClientClass {
  return class BoundPrismaClient extends PrismaClient {
    constructor(options?: Partial<ClientOptions>) {
      super({ ...options, adapter: createAdapter(connection) });
    }
  };
}
