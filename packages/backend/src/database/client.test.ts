import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDatabaseConfigFromEnv,
  createDatabaseClient,
  performHealthCheck,
  disconnectDatabase,
} from './client';
import type { DatabaseConfig, HealthCheckResult } from './types';

/**
 * Tests for Database Client Utilities
 *
 * These tests ensure:
 * - Environment variable parsing works correctly
 * - Database client creation with various configurations
 * - Health check functionality for different client types
 * - Safe database disconnection
 * - Error handling for unsupported clients
 */
describe('Database Client Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getDatabaseConfigFromEnv', () => {
    it('should return configuration from environment variables', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.DB_LOG = 'query,error,warn';
      process.env.DB_ERROR_FORMAT = 'pretty';

      const config = getDatabaseConfigFromEnv();

      expect(config.databaseUrl).toBe('postgresql://localhost:5432/test');
      expect(config.log).toEqual(['query', 'error', 'warn']);
      expect(config.errorFormat).toBe('pretty');
    });

    it('should default to error log level if DB_LOG not set', () => {
      delete process.env.DB_LOG;

      const config = getDatabaseConfigFromEnv();

      expect(config.log).toEqual(['error']);
    });

    it('should default to colorless error format if DB_ERROR_FORMAT not set', () => {
      delete process.env.DB_ERROR_FORMAT;

      const config = getDatabaseConfigFromEnv();

      expect(config.errorFormat).toBe('colorless');
    });

    it('should handle single log level', () => {
      process.env.DB_LOG = 'query';

      const config = getDatabaseConfigFromEnv();

      expect(config.log).toEqual(['query']);
    });

    it('should handle minimal error format', () => {
      process.env.DB_ERROR_FORMAT = 'minimal';

      const config = getDatabaseConfigFromEnv();

      expect(config.errorFormat).toBe('minimal');
    });

    it('should handle colorless error format', () => {
      process.env.DB_ERROR_FORMAT = 'colorless';

      const config = getDatabaseConfigFromEnv();

      expect(config.errorFormat).toBe('colorless');
    });

    it('should handle undefined DATABASE_URL', () => {
      delete process.env.DATABASE_URL;

      const config = getDatabaseConfigFromEnv();

      expect(config.databaseUrl).toBeUndefined();
    });

    it('should parse comma-separated log levels', () => {
      process.env.DB_LOG = 'query,info,warn,error';

      const config = getDatabaseConfigFromEnv();

      expect(config.log).toEqual(['query', 'info', 'warn', 'error']);
    });
  });

  describe('createDatabaseClient', () => {
    it('should create client with environment configuration', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.DB_LOG = 'query,error';
      process.env.DB_ERROR_FORMAT = 'pretty';

      class MockClient {
        constructor(public config: any) {}
      }

      const client = createDatabaseClient(MockClient);

      expect(client).toBeInstanceOf(MockClient);
      expect(client.config.datasources.db.url).toBe('postgresql://localhost:5432/test');
      expect(client.config.log).toEqual(['query', 'error']);
      expect(client.config.errorFormat).toBe('pretty');
    });

    it('should override environment config with provided config', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/env';
      process.env.DB_LOG = 'error';

      class MockClient {
        constructor(public config: any) {}
      }

      const customConfig: DatabaseConfig = {
        databaseUrl: 'postgresql://localhost:5432/custom',
        log: ['query', 'info'],
        errorFormat: 'minimal',
      };

      const client = createDatabaseClient(MockClient, customConfig);

      expect(client.config.datasources.db.url).toBe('postgresql://localhost:5432/custom');
      expect(client.config.log).toEqual(['query', 'info']);
      expect(client.config.errorFormat).toBe('minimal');
    });

    it('should handle empty configuration', () => {
      delete process.env.DATABASE_URL;
      delete process.env.DB_LOG;
      delete process.env.DB_ERROR_FORMAT;

      class MockClient {
        constructor(public config: any) {}
      }

      const client = createDatabaseClient(MockClient);

      expect(client).toBeInstanceOf(MockClient);
      expect(client.config.log).toEqual(['error']);
      expect(client.config.errorFormat).toBe('colorless');
    });

    it('should include clientOptions in configuration', () => {
      class MockClient {
        constructor(public config: any) {}
      }

      const customConfig: DatabaseConfig = {
        databaseUrl: 'postgresql://localhost:5432/test',
        clientOptions: {
          connectionLimit: 10,
          timeout: 5000,
        },
      };

      const client = createDatabaseClient(MockClient, customConfig);

      expect(client.config.connectionLimit).toBe(10);
      expect(client.config.timeout).toBe(5000);
    });

    it('should not add datasources if databaseUrl not provided', () => {
      delete process.env.DATABASE_URL;

      class MockClient {
        constructor(public config: any) {}
      }

      const client = createDatabaseClient(MockClient, { log: ['query'] });

      expect(client.config.datasources).toBeUndefined();
      expect(client.config.log).toEqual(['query']);
    });
  });

  describe('performHealthCheck', () => {
    it('should return success for Prisma-style client', async () => {
      const mockClient = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ 'VERSION()': 'PostgreSQL 14.0' }]),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.version).toBe('PostgreSQL 14.0');
      expect(mockClient.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should return success without version if version query fails', async () => {
      const mockClient = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([])
          .mockRejectedValueOnce(new Error('Version query failed')),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.version).toBeUndefined();
    });

    it('should work with execute-style client (Drizzle)', async () => {
      const mockClient = {
        execute: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ 'VERSION()': 'MySQL 8.0' }]),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.version).toBe('MySQL 8.0');
      expect(mockClient.execute).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return error when client has no query method', async () => {
      const mockClient = {
        // No $queryRaw or execute method
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Unsupported database client - no query method found');
    });

    it('should return error when health check query fails', async () => {
      const mockClient = {
        $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(false);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle non-Error exceptions', async () => {
      const mockClient = {
        $queryRaw: vi.fn().mockRejectedValue('String error'),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle empty version result', async () => {
      const mockClient = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(true);
      expect(result.version).toBeUndefined();
    });

    it('should handle non-array version result', async () => {
      const mockClient = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce({ version: 'PostgreSQL 14.0' }),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(true);
      expect(result.version).toBeUndefined();
    });

    it('should measure response time accurately', async () => {
      const mockClient = {
        $queryRaw: vi.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve([]), 10);
          });
        }),
      };

      const result = await performHealthCheck(mockClient);

      expect(result.connected).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(10);
    });
  });

  describe('disconnectDatabase', () => {
    it('should disconnect Prisma client', async () => {
      const mockClient = {
        $disconnect: vi.fn().mockResolvedValue(undefined),
      };

      await disconnectDatabase(mockClient);

      expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('should close client with close method', async () => {
      const mockClient = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      await disconnectDatabase(mockClient);

      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });

    it('should destroy client with destroy method', async () => {
      const mockClient = {
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      await disconnectDatabase(mockClient);

      expect(mockClient.destroy).toHaveBeenCalledTimes(1);
    });

    it('should handle client with no disconnect method gracefully', async () => {
      const mockClient = {};

      await expect(disconnectDatabase(mockClient)).resolves.not.toThrow();
    });

    it('should handle disconnect errors gracefully', async () => {
      const mockClient = {
        $disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      };

      await expect(disconnectDatabase(mockClient)).resolves.not.toThrow();
      expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error disconnect exceptions', async () => {
      const mockClient = {
        $disconnect: vi.fn().mockRejectedValue('String error'),
      };

      await expect(disconnectDatabase(mockClient)).resolves.not.toThrow();
    });

    it('should prioritize $disconnect over other methods', async () => {
      const mockClient = {
        $disconnect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      await disconnectDatabase(mockClient);

      expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);
      expect(mockClient.close).not.toHaveBeenCalled();
      expect(mockClient.destroy).not.toHaveBeenCalled();
    });

    it('should prioritize close over destroy', async () => {
      const mockClient = {
        close: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      await disconnectDatabase(mockClient);

      expect(mockClient.close).toHaveBeenCalledTimes(1);
      expect(mockClient.destroy).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should create and health check a mock Prisma client', async () => {
      class MockPrismaClient {
        constructor(public config: any) {}

        $queryRaw = vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ 'VERSION()': 'PostgreSQL 14.0' }]);

        $disconnect = vi.fn().mockResolvedValue(undefined);
      }

      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

      const client = createDatabaseClient(MockPrismaClient);
      const health = await performHealthCheck(client);
      await disconnectDatabase(client);

      expect(health.connected).toBe(true);
      expect(health.version).toBe('PostgreSQL 14.0');
      expect(client.$disconnect).toHaveBeenCalled();
    });

    it('should handle complete lifecycle with custom config', async () => {
      class MockClient {
        constructor(public config: any) {}

        execute = vi.fn().mockResolvedValue([]);
        close = vi.fn().mockResolvedValue(undefined);
      }

      const config: DatabaseConfig = {
        databaseUrl: 'mysql://localhost:3306/test',
        log: ['query', 'error'],
        errorFormat: 'minimal',
      };

      const client = createDatabaseClient(MockClient, config);
      const health = await performHealthCheck(client);
      await disconnectDatabase(client);

      expect(client.config.datasources.db.url).toBe('mysql://localhost:3306/test');
      expect(health.connected).toBe(true);
      expect(client.close).toHaveBeenCalled();
    });
  });
});

/**
 * TESTABILITY SCORE: 10/10
 *
 * These utilities are PERFECTLY testable because:
 * ✅ Pure functions with clear inputs/outputs
 * ✅ No global state or singletons
 * ✅ Easy to mock dependencies
 * ✅ Clear separation of concerns
 * ✅ Excellent error handling
 * ✅ Generic/reusable across ORMs
 *
 * No testability issues!
 *
 * ARCHITECTURE RECOMMENDATIONS:
 *
 * 1. **Add Type Guards:**
 * ```typescript
 * export function isPrismaClient(client: any): client is PrismaClient {
 *   return typeof client.$queryRaw === 'function';
 * }
 * ```
 * This provides better type safety for client detection.
 *
 * 2. **Add Connection Pool Monitoring:**
 * ```typescript
 * export async function getConnectionStats(client: any): Promise<{
 *   activeConnections: number;
 *   idleConnections: number;
 * }> {
 *   // Implementation for connection pool stats
 * }
 * ```
 * This enables monitoring of connection pool health.
 *
 * 3. **Add Retry Logic for Health Checks:**
 * ```typescript
 * export async function performHealthCheckWithRetry(
 *   client: any,
 *   maxRetries = 3,
 *   delay = 1000
 * ): Promise<HealthCheckResult> {
 *   // Retry logic implementation
 * }
 * ```
 * This makes health checks more robust.
 *
 * 4. **Add Configuration Validation:**
 * ```typescript
 * export function validateDatabaseConfig(config: DatabaseConfig): void {
 *   if (!config.databaseUrl) {
 *     throw new Error('DATABASE_URL is required');
 *   }
 *   // Additional validation
 * }
 * ```
 * This catches configuration errors early.
 *
 * 5. **Add Metrics Collection:**
 * ```typescript
 * export interface HealthCheckMetrics {
 *   timestamp: Date;
 *   responseTime: number;
 *   connected: boolean;
 *   queryCount?: number;
 * }
 * ```
 * This enables performance monitoring over time.
 */
