import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from './database.service';
import type { UserContext } from '@/utils';

/**
 * Tests for DatabaseService
 *
 * These tests ensure:
 * - Database connection lifecycle works correctly
 * - User context operations execute within transactions
 * - Singleton pattern works with typed instances
 * - Error handling is consistent
 *
 * Note: RLS has been removed from this codebase.
 * The withUserContext function now simply wraps operations in a transaction
 * for API compatibility with existing code.
 */
describe('DatabaseService', () => {
  let mockPrismaClient: any;
  let mockTx: any;
  let PrismaClientClass: any;

  beforeEach(() => {
    // Create mock transaction
    mockTx = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'user-123' }),
      },
    };

    // Create mock Prisma client
    mockPrismaClient = {
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(async (callback) => callback(mockTx)),
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    // Create mock Prisma client class
    PrismaClientClass = vi.fn(function () {
      return mockPrismaClient;
    });
  });

  afterEach(async () => {
    // Clean up singleton instances
    await DatabaseService.reset();
  });

  describe('constructor', () => {
    it('should create instance with service name "database"', () => {
      const service = new DatabaseService(PrismaClientClass);
      expect(service.getName()).toBe('database');
    });

    it('should accept Prisma client class', () => {
      const service = new DatabaseService(PrismaClientClass);
      expect(service).toBeDefined();
    });

    it('should create instance without Prisma client class', () => {
      const service = new DatabaseService();
      expect(service).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should create Prisma client instance', async () => {
      const service = new DatabaseService(PrismaClientClass);
      await service.start();

      expect(PrismaClientClass).toHaveBeenCalled();
      expect(service.client).toBe(mockPrismaClient);
    });

    it('should connect to database', async () => {
      const service = new DatabaseService(PrismaClientClass);
      await service.start();

      expect(mockPrismaClient.$connect).toHaveBeenCalled();
    });

    it('should throw error if Prisma client class not provided', async () => {
      const service = new DatabaseService();

      await expect(service.start()).rejects.toThrow(
        'PrismaClient class not provided',
      );
    });

    it('should use development log config in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const service = new DatabaseService(PrismaClientClass);
      await service.start();

      expect(PrismaClientClass).toHaveBeenCalledWith({
        log: expect.arrayContaining(['error', 'warn']),
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should use minimal log config in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const service = new DatabaseService(PrismaClientClass);
      await service.start();

      expect(PrismaClientClass).toHaveBeenCalledWith({
        log: ['error'],
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle connection errors', async () => {
      mockPrismaClient.$connect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const service = new DatabaseService(PrismaClientClass);

      await expect(service.start()).rejects.toThrow('Connection failed');
    });
  });

  describe('shutdown', () => {
    it('should disconnect from database', async () => {
      const service = new DatabaseService(PrismaClientClass);
      await service.start();
      await service.stop();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      const service = new DatabaseService(PrismaClientClass);

      // Should not throw
      await expect(service.stop()).resolves.toBeUndefined();
    });

    it('should handle disconnect errors', async () => {
      mockPrismaClient.$disconnect = vi.fn().mockRejectedValue(new Error('Disconnect failed'));

      const service = new DatabaseService(PrismaClientClass);
      await service.start();

      await expect(service.stop()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      const service = new DatabaseService(PrismaClientClass);
      await service.start();

      const connected = await service.isConnected();
      expect(connected).toBe(true);
    });

    it('should return false when client not initialized', async () => {
      const service = new DatabaseService(PrismaClientClass);

      const connected = await service.isConnected();
      expect(connected).toBe(false);
    });

    it('should return false when connection fails', async () => {
      mockPrismaClient.$connect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const service = new DatabaseService(PrismaClientClass);
      await service.start().catch(() => {});

      const connected = await service.isConnected();
      expect(connected).toBe(false);
    });

    it('should attempt reconnection when checking connection', async () => {
      const service = new DatabaseService(PrismaClientClass);
      await service.start();

      mockPrismaClient.$connect.mockClear();
      await service.isConnected();

      expect(mockPrismaClient.$connect).toHaveBeenCalled();
    });
  });

  describe('withUserContext', () => {
    let service: DatabaseService;

    beforeEach(async () => {
      service = new DatabaseService(PrismaClientClass);
      await service.start();
    });

    it('should execute operation within transaction', async () => {
      const context: UserContext = { userId: 'user-123' };
      const operation = vi.fn().mockResolvedValue('result');

      await service.withUserContext(context, operation);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledWith(mockTx);
    });

    it('should return operation result', async () => {
      const context: UserContext = { userId: 'user-123' };
      const expectedResult = { id: 'result-123', data: 'test' };
      const operation = vi.fn().mockResolvedValue(expectedResult);

      const result = await service.withUserContext(context, operation);

      expect(result).toEqual(expectedResult);
    });

    it('should use ReadCommitted isolation level', async () => {
      const context: UserContext = { userId: 'user-123' };
      const operation = vi.fn().mockResolvedValue('result');

      await service.withUserContext(context, operation);

      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
      );
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedService = new DatabaseService(PrismaClientClass);
      const context: UserContext = { userId: 'user-123' };
      const operation = vi.fn();

      await expect(
        uninitializedService.withUserContext(context, operation),
      ).rejects.toThrow('Prisma client not initialized');
    });

    it('should propagate operation errors', async () => {
      const context: UserContext = { userId: 'user-123' };
      const error = new Error('Operation failed');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(service.withUserContext(context, operation)).rejects.toThrow(
        'Operation failed',
      );
    });

    it('should allow multiple database operations in callback', async () => {
      const context: UserContext = { userId: 'user-123' };

      const result = await service.withUserContext(context, async (tx) => {
        await tx.user.create({ data: { email: 'test@example.com' } });
        const users = await tx.user.findMany();
        return users;
      });

      expect(mockTx.user.create).toHaveBeenCalled();
      expect(mockTx.user.findMany).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should accept complex user contexts (API compatibility)', async () => {
      const context: UserContext = {
        userId: 'user-123',
        showDeleted: true,
        userClerkId: 'clerk-user-123',
      };
      const operation = vi.fn().mockResolvedValue('result');

      await service.withUserContext(context, operation);

      expect(operation).toHaveBeenCalled();
    });
  });

  describe('singleton pattern', () => {
    it('should create typed instance', async () => {
      const instance = await DatabaseService.createTypedInstance(PrismaClientClass);

      expect(instance).toBeInstanceOf(DatabaseService);
      expect(instance.isReady()).toBe(true);
    });

    it('should return same instance on subsequent calls', async () => {
      const instance1 = await DatabaseService.createTypedInstance(PrismaClientClass);
      const instance2 = await DatabaseService.createTypedInstance(PrismaClientClass);

      expect(instance1).toBe(instance2);
    });

    it('should auto-start service when creating instance', async () => {
      const instance = await DatabaseService.createTypedInstance(PrismaClientClass);

      expect(instance.client).toBeDefined();
      expect(mockPrismaClient.$connect).toHaveBeenCalled();
    });

    it('should reset instance', async () => {
      const instance1 = await DatabaseService.createTypedInstance(PrismaClientClass);
      await DatabaseService.reset();

      const instance2 = await DatabaseService.createTypedInstance(PrismaClientClass);

      expect(instance1).not.toBe(instance2);
    });

    it('should disconnect when resetting', async () => {
      await DatabaseService.createTypedInstance(PrismaClientClass);
      mockPrismaClient.$disconnect.mockClear();

      await DatabaseService.reset();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });

    it('should clear Prisma client class on reset', async () => {
      await DatabaseService.createTypedInstance(PrismaClientClass);
      await DatabaseService.reset();

      const service = new DatabaseService();
      await expect(service.start()).rejects.toThrow('PrismaClient class not provided');
    });
  });

  describe('getClient (static method)', () => {
    it('should return client from singleton instance', async () => {
      const instance = await DatabaseService.createTypedInstance(PrismaClientClass);
      const client = DatabaseService.getClient();

      expect(client).toBe(instance.client);
      expect(client).toBe(mockPrismaClient);
    });

    it('should throw error if not initialized', () => {
      expect(() => DatabaseService.getClient()).toThrow(
        'DatabaseService service not initialized',
      );
    });
  });

  describe('integration scenarios', () => {
    it('should support user data operations with context', async () => {
      const service = await DatabaseService.createTypedInstance(PrismaClientClass);

      mockTx.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });

      const result = await service.withUserContext(
        { userId: 'creator-123' },
        async (tx) => {
          return tx.user.create({
            data: { email: 'test@example.com' },
          });
        },
      );

      expect(result.email).toBe('test@example.com');
      expect(mockTx.user.create).toHaveBeenCalled();
    });

    it('should support user-scoped operations', async () => {
      const service = await DatabaseService.createTypedInstance(PrismaClientClass);

      const context: UserContext = {
        userId: 'user-123',
      };

      await service.withUserContext(context, async (tx) => {
        await tx.user.findMany({ where: { id: 'user-123' } });
      });

      expect(mockTx.user.findMany).toHaveBeenCalled();
    });

    it('should handle service restart', async () => {
      const service = await DatabaseService.createTypedInstance(PrismaClientClass);

      await service.stop();
      await service.start();

      expect(service.isReady()).toBe(true);
      expect(mockPrismaClient.$connect).toHaveBeenCalledTimes(2);
    });
  });
});

/**
 * TESTABILITY SCORE: 8/10
 *
 * This service is HIGHLY testable because:
 * ✅ Extends well-tested BaseService
 * ✅ Accepts Prisma client class as dependency (easily mockable)
 * ✅ Clear lifecycle methods
 * ✅ Singleton pattern is well-implemented
 * ✅ Most methods are pure or have clear side effects
 *
 * Testability issues:
 * - Static PrismaClientClass makes concurrent tests harder
 * - Logging is coupled to implementation
 *
 * Note: RLS (Row Level Security) has been removed from this codebase.
 * The withUserContext function now simply wraps operations in a transaction
 * for API compatibility with existing code.
 */
