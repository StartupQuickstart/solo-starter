import { describe, expect, it } from 'vitest';

import { boundPrismaClient, createPrismaClient } from './prisma-client';

/** Nothing listens here. Constructing a client must not need a database. */
const UNREACHABLE = { url: 'postgresql://nobody:nothing@127.0.0.1:1/none', maxConnections: 2 } as const;

describe('createPrismaClient', () => {
  it('builds a client without opening a connection', () => {
    const client = createPrismaClient(UNREACHABLE);

    // The client's own surface: a model from this schema, and raw queries.
    // EXAMPLE: notes. Uses the example model as its sample (twice in this file).
    expect(typeof client.note.findMany).toBe('function');
    expect(typeof client.$transaction).toBe('function');
  });

  it('reports an unreachable database on the first query, not at construction', async () => {
    const client = createPrismaClient(UNREACHABLE);

    await expect(client.$queryRaw`SELECT 1`).rejects.toThrow();
  });
});

describe('boundPrismaClient', () => {
  it('is a PrismaClient class that needs no arguments, for code that constructs the client itself', () => {
    const BoundClient = boundPrismaClient(UNREACHABLE);

    const client = new BoundClient();

    // EXAMPLE: notes. The second use of the example model.
    expect(typeof client.note.findMany).toBe('function');
    expect(typeof client.$connect).toBe('function');
  });

  it('accepts the logging options Backend passes, and still connects through the adapter', async () => {
    const BoundClient = boundPrismaClient(UNREACHABLE);
    const client = new BoundClient({ log: ['error'] });

    // A client built without an adapter fails differently: at construction.
    await expect(client.$queryRaw`SELECT 1`).rejects.toThrow();
  });
});
