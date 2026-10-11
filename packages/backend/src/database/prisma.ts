import { dbLogger } from '@/utils/logger';
import type { UserContext } from '@/utils/user-context';

/**
 * Global Prisma client instance with connection management
 */
export function createPrismaClient(PrismaClient: any): any {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return client;
}

/**
 * Create a singleton Prisma client
 */
export function createSingletonPrismaClient(PrismaClient: any): any {
  const globalForPrisma = globalThis as unknown as {
    prisma: any | undefined;
  };

  const prisma = globalForPrisma.prisma ?? createPrismaClient(PrismaClient);

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}

/**
 * Executes a database operation with user context within a transaction
 * Note: RLS has been removed, this now just executes the operation in a transaction
 * @param db - Prisma client instance
 * @param context - User context (retained for API compatibility)
 * @param operation - Database operation to execute (receives the transaction instance)
 * @returns Promise with the operation result
 */
export async function withUserContext<T>(
  db: any,
  _context: UserContext,
  operation: (tx: any) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx: any) => {
      // Execute the operation with the transaction instance
      return operation(tx);
    },
    {
      isolationLevel: 'ReadCommitted',
    },
  );
}

/**
 * Test database connection
 * @param db - Prisma client instance
 * @returns Promise that resolves if connection is successful
 */
export async function testPrismaConnection(db: any): Promise<boolean> {
  try {
    await db.$connect();
    dbLogger.info('Database connection successful');
    return true;
  } catch (error) {
    dbLogger.error('Database connection failed', {
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}
