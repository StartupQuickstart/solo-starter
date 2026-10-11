import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPrismaClient,
  createSingletonPrismaClient,
  withUserContext,
  testPrismaConnection,
} from './prisma';
import type { UserContext } from '@/utils/user-context';

/**
 * Tests for Prisma Database Utilities
 *
 * These tests ensure:
 * - Prisma client creation with correct configuration
 * - Singleton pattern works correctly
 * - Transaction isolation levels
 * - Connection testing
 * - User context wrapper (API compatibility, RLS removed)
 */
describe('Prisma Database Utilities', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalGlobal = (globalThis as any).prisma;

  beforeEach(() => {
    // Clean up global state
    delete (globalThis as any).prisma;
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
    (globalThis as any).prisma = originalGlobal;
  });

  describe('createPrismaClient', () => {
    it('should create Prisma client with development logging', () => {
      process.env.NODE_ENV = 'development';

      const MockPrismaClient = vi.fn();
      createPrismaClient(MockPrismaClient);

      expect(MockPrismaClient).toHaveBeenCalledWith({
        log: ['error', 'warn'],
      });
    });

    it('should create Prisma client with production logging', () => {
      process.env.NODE_ENV = 'production';

      const MockPrismaClient = vi.fn();
      createPrismaClient(MockPrismaClient);

      expect(MockPrismaClient).toHaveBeenCalledWith({
        log: ['error'],
      });
    });

    it('should create Prisma client with error-only logging in test', () => {
      process.env.NODE_ENV = 'test';

      const MockPrismaClient = vi.fn();
      createPrismaClient(MockPrismaClient);

      expect(MockPrismaClient).toHaveBeenCalledWith({
        log: ['error'],
      });
    });

    it('should return client instance', () => {
      const mockInstance = { $connect: vi.fn() };
      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      const client = createPrismaClient(MockPrismaClient);

      expect(client).toBe(mockInstance);
    });
  });

  describe('createSingletonPrismaClient', () => {
    it('should create new client if none exists', () => {
      const mockInstance = { $connect: vi.fn() };
      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      const client = createSingletonPrismaClient(MockPrismaClient);

      expect(client).toBe(mockInstance);
      expect(MockPrismaClient).toHaveBeenCalledTimes(1);
    });

    it('should reuse existing client in non-production', () => {
      process.env.NODE_ENV = 'development';

      const mockInstance = { $connect: vi.fn() };
      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      const client1 = createSingletonPrismaClient(MockPrismaClient);
      const client2 = createSingletonPrismaClient(MockPrismaClient);

      expect(client1).toBe(client2);
      expect(MockPrismaClient).toHaveBeenCalledTimes(1);
    });

    it('should store client in globalThis in development', () => {
      process.env.NODE_ENV = 'development';

      const mockInstance = { $connect: vi.fn() };
      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      createSingletonPrismaClient(MockPrismaClient);

      expect((globalThis as any).prisma).toBe(mockInstance);
    });

    it('should not store client in globalThis in production', () => {
      process.env.NODE_ENV = 'production';

      const mockInstance = { $connect: vi.fn() };
      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      createSingletonPrismaClient(MockPrismaClient);

      expect((globalThis as any).prisma).toBeUndefined();
    });

    it('should create new client each time in production', () => {
      process.env.NODE_ENV = 'production';

      const mockInstance1 = { $connect: vi.fn() };
      const mockInstance2 = { $connect: vi.fn() };
      const instances = [mockInstance1, mockInstance2];
      const MockPrismaClient = vi.fn(function () {
        return instances.shift();
      });

      const client1 = createSingletonPrismaClient(MockPrismaClient);
      const client2 = createSingletonPrismaClient(MockPrismaClient);

      expect(client1).toBe(mockInstance1);
      expect(client2).toBe(mockInstance2);
      expect(MockPrismaClient).toHaveBeenCalledTimes(2);
    });

    it('should reuse existing global client', () => {
      const existingClient = { $connect: vi.fn() };
      (globalThis as any).prisma = existingClient;

      const MockPrismaClient = vi.fn();
      const client = createSingletonPrismaClient(MockPrismaClient);

      expect(client).toBe(existingClient);
      expect(MockPrismaClient).not.toHaveBeenCalled();
    });
  });

  describe('withUserContext', () => {
    it('should execute operation within transaction with user context', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ id: '123', name: 'Test' });
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-123',
      };

      const result = await withUserContext(mockDb, context, mockOperation);

      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(mockDb.$transaction).toHaveBeenCalled();
      expect(mockOperation).toHaveBeenCalledWith(mockTx);
    });

    it('should accept user context fields (API compatibility)', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-uuid-123',
        showDeleted: true,
        userClerkId: 'clerk_user_123',
      };

      await withUserContext(mockDb, context, mockOperation);

      expect(mockOperation).toHaveBeenCalled();
    });

    it('should handle minimal context', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-123',
      };

      await withUserContext(mockDb, context, mockOperation);

      expect(mockOperation).toHaveBeenCalled();
    });

    it('should handle an empty context', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {};

      await withUserContext(mockDb, context, mockOperation);

      expect(mockOperation).toHaveBeenCalled();
    });

    it('should handle a context with only a user id', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-123',
      };

      await withUserContext(mockDb, context, mockOperation);

      expect(mockOperation).toHaveBeenCalled();
    });

    it('should use ReadCommitted isolation level', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-123',
      };

      await withUserContext(mockDb, context, mockOperation);

      expect(mockDb.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'ReadCommitted' },
      );
    });

    it('should propagate operation errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-123',
      };

      await expect(withUserContext(mockDb, context, mockOperation)).rejects.toThrow(
        'Operation failed',
      );
    });

    it('should return operation result', async () => {
      const expectedResult = { users: [{ id: '1' }, { id: '2' }], count: 2 };
      const mockOperation = vi.fn().mockResolvedValue(expectedResult);
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-123',
      };

      const result = await withUserContext(mockDb, context, mockOperation);

      expect(result).toEqual(expectedResult);
    });

    it('should allow multiple database operations in callback', async () => {
      const mockOperation = vi.fn().mockImplementation(async (tx) => {
        await tx.user.findMany();
        await tx.note.findMany();
        return { success: true };
      });

      const mockTx = {
        user: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        note: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'user-123',
      };

      await withUserContext(mockDb, context, mockOperation);

      expect(mockTx.user.findMany).toHaveBeenCalled();
      expect(mockTx.note.findMany).toHaveBeenCalled();
    });

    it('should handle complex user contexts', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockTx = {};
      const mockDb = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const context: UserContext = {
        userId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        showDeleted: true,
        userClerkId: 'user_2abcdefghijklmnopqrstuvwxyz',
      };

      await withUserContext(mockDb, context, mockOperation);

      expect(mockOperation).toHaveBeenCalled();
    });
  });

  describe('testPrismaConnection', () => {
    it('should return true when connection successful', async () => {
      const mockDb = {
        $connect: vi.fn().mockResolvedValue(undefined),
      };

      const result = await testPrismaConnection(mockDb);

      expect(result).toBe(true);
      expect(mockDb.$connect).toHaveBeenCalled();
    });

    it('should return false when connection fails', async () => {
      const mockDb = {
        $connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const result = await testPrismaConnection(mockDb);

      expect(result).toBe(false);
      expect(mockDb.$connect).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      const mockDb = {
        $connect: vi.fn().mockRejectedValue('String error'),
      };

      const result = await testPrismaConnection(mockDb);

      expect(result).toBe(false);
    });

    it('should handle null/undefined errors', async () => {
      const mockDb = {
        $connect: vi.fn().mockRejectedValue(null),
      };

      const result = await testPrismaConnection(mockDb);

      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should create singleton client and test connection', async () => {
      const mockInstance = {
        $connect: vi.fn().mockResolvedValue(undefined),
      };
      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      const client = createSingletonPrismaClient(MockPrismaClient);
      const connected = await testPrismaConnection(client);

      expect(connected).toBe(true);
      expect(mockInstance.$connect).toHaveBeenCalled();
    });

    it('should create client and execute operation with context', async () => {
      const mockInstance = {
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn({
            user: {
              findMany: vi.fn().mockResolvedValue([{ id: '1' }]),
            },
          });
        }),
      };
      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      const client = createPrismaClient(MockPrismaClient);
      const result = await withUserContext(
        client,
        { userId: 'user-123' },
        async (tx) => {
          return tx.user.findMany();
        },
      );

      expect(result).toEqual([{ id: '1' }]);
    });

    it('should handle full lifecycle with transaction', async () => {
      const mockTx = {
        user: {
          create: vi.fn().mockResolvedValue({ id: 'new-user' }),
        },
      };

      const mockInstance = {
        $connect: vi.fn().mockResolvedValue(undefined),
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTx);
        }),
      };

      const MockPrismaClient = vi.fn(function () {
        return mockInstance;
      });

      // Create client
      const client = createSingletonPrismaClient(MockPrismaClient);

      // Test connection
      const connected = await testPrismaConnection(client);
      expect(connected).toBe(true);

      // Execute operation with user context
      const context: UserContext = {
        userId: 'admin-user-123',
        showDeleted: false,
      };

      const result = await withUserContext(client, context, async (tx) => {
        return tx.user.create({ data: { email: 'test@example.com' } });
      });

      expect(result).toEqual({ id: 'new-user' });
      expect(mockTx.user.create).toHaveBeenCalled();
    });
  });
});

/**
 * TESTABILITY SCORE: 9/10
 *
 * These utilities are HIGHLY testable because:
 * ✅ Clear separation of concerns
 * ✅ Easy to mock Prisma client
 * ✅ Excellent error handling
 * ✅ Transaction-based operations (no global state)
 * ✅ Simple API surface
 *
 * Minor testability issues:
 * - Uses globalThis for singleton (but manageable in tests)
 * - Reads process.env.NODE_ENV directly
 *
 * Note: RLS (Row Level Security) has been removed from this codebase.
 * The withUserContext function now simply wraps operations in a transaction
 * for API compatibility with existing code.
 */
