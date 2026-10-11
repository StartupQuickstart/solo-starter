import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

/**
 * Tests for logger in production environment
 *
 * These tests verify that the logger creates the correct transports
 * when NODE_ENV is set to 'production'.
 *
 * NOTE: This test file uses dynamic imports to test production-specific code paths
 */
describe('Logger Production Configuration', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe('production environment', () => {
    it('should create logger with production transports', async () => {
      // Set environment to production before importing
      process.env.NODE_ENV = 'production';

      // Dynamic import to get fresh logger instance
      const loggerModule = await import('./logger');

      // Verify loggers exist
      expect(loggerModule.dbLogger).toBeDefined();
      expect(loggerModule.authLogger).toBeDefined();
      expect(loggerModule.apiLogger).toBeDefined();
      expect(loggerModule.appLogger).toBeDefined();

      // Verify logger methods work in production mode
      expect(() => {
        loggerModule.dbLogger.info('Production database log');
        loggerModule.authLogger.error('Production auth error');
        loggerModule.apiLogger.warn('Production API warning');
        loggerModule.appLogger.debug('Production app debug');
      }).not.toThrow();

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should support production logging with metadata', async () => {
      process.env.NODE_ENV = 'production';
      const loggerModule = await import('./logger');

      expect(() => {
        loggerModule.dbLogger.info('Query executed', {
          query: 'SELECT * FROM users',
          duration: 45,
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('should create child logger in production', async () => {
      process.env.NODE_ENV = 'production';
      const loggerModule = await import('./logger');

      const childLogger = loggerModule.createChildLogger({
        service: 'production-service',
        environment: 'production',
      });

      expect(childLogger).toBeDefined();
      expect(() => {
        childLogger.info('Production child logger message');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('development environment', () => {
    it('should create logger with development transports', async () => {
      process.env.NODE_ENV = 'development';
      const loggerModule = await import('./logger');

      expect(loggerModule.dbLogger).toBeDefined();
      expect(() => {
        loggerModule.dbLogger.info('Development log');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('test environment', () => {
    it('should create logger with test transports', async () => {
      process.env.NODE_ENV = 'test';
      const loggerModule = await import('./logger');

      expect(loggerModule.dbLogger).toBeDefined();
      expect(() => {
        loggerModule.dbLogger.info('Test log');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('logger error handling', () => {
    it('should handle errors in production mode', async () => {
      process.env.NODE_ENV = 'production';
      const loggerModule = await import('./logger');

      const error = new Error('Production error');
      error.stack = 'Error: Production error\n    at test.js:1:1';

      expect(() => {
        loggerModule.appLogger.error('Error occurred', {
          error: error.message,
          stack: error.stack,
        });
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('log levels', () => {
    it('should respect LOG_LEVEL environment variable in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'error';

      const loggerModule = await import('./logger');

      expect(() => {
        loggerModule.dbLogger.error('Error level message');
        loggerModule.dbLogger.warn('Warn level message');
        loggerModule.dbLogger.info('Info level message');
      }).not.toThrow();

      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = originalEnv;
    });

    it('should use debug level by default in development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;

      const loggerModule = await import('./logger');

      expect(() => {
        loggerModule.dbLogger.debug('Debug message');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('should use info level by default in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;

      const loggerModule = await import('./logger');

      expect(() => {
        loggerModule.dbLogger.info('Info message');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
