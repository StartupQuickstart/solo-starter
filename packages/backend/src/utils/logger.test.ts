import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChildLogger, dbLogger, authLogger, apiLogger, appLogger } from './logger';

/**
 * Tests for logger utility
 *
 * These tests ensure:
 * - Child logger creation works correctly
 * - Specialized loggers (db, auth, api, app) are initialized
 * - Logger instances have all required methods
 * - Loggers can be called without errors
 */
describe('Logger Utilities', () => {
  // Suppress console output during tests
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createChildLogger', () => {
    it('should create a child logger with context', () => {
      const context = { service: 'test-service', userId: '123' };
      const childLogger = createChildLogger(context);

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.warn).toBe('function');
      expect(typeof childLogger.debug).toBe('function');
    });

    it('should create a child logger with empty context', () => {
      const childLogger = createChildLogger({});

      expect(childLogger).toBeDefined();
    });

    it('should create multiple independent child loggers', () => {
      const logger1 = createChildLogger({ service: 'service1' });
      const logger2 = createChildLogger({ service: 'service2' });

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
      expect(logger1).not.toBe(logger2);
    });

    it('should create child logger with nested context', () => {
      const context = {
        service: 'test',
        metadata: {
          userId: '123',
          requestId: 'req-456',
        },
      };
      const childLogger = createChildLogger(context);

      expect(childLogger).toBeDefined();
    });

    it('should allow calling log methods on child logger', () => {
      const childLogger = createChildLogger({ service: 'test' });

      expect(() => {
        childLogger.info('Test info message');
        childLogger.error('Test error message');
        childLogger.warn('Test warn message');
        childLogger.debug('Test debug message');
      }).not.toThrow();
    });
  });

  describe('specialized loggers', () => {
    describe('dbLogger', () => {
      it('should be defined', () => {
        expect(dbLogger).toBeDefined();
      });

      it('should have all log methods', () => {
        expect(typeof dbLogger.info).toBe('function');
        expect(typeof dbLogger.error).toBe('function');
        expect(typeof dbLogger.warn).toBe('function');
        expect(typeof dbLogger.debug).toBe('function');
      });

      it('should allow logging messages', () => {
        expect(() => {
          dbLogger.info('Database connection established');
          dbLogger.error('Database error occurred');
        }).not.toThrow();
      });

      it('should log with metadata', () => {
        expect(() => {
          dbLogger.info('Query executed', { query: 'SELECT * FROM users', duration: 123 });
        }).not.toThrow();
      });
    });

    describe('authLogger', () => {
      it('should be defined', () => {
        expect(authLogger).toBeDefined();
      });

      it('should have all log methods', () => {
        expect(typeof authLogger.info).toBe('function');
        expect(typeof authLogger.error).toBe('function');
        expect(typeof authLogger.warn).toBe('function');
        expect(typeof authLogger.debug).toBe('function');
      });

      it('should allow logging messages', () => {
        expect(() => {
          authLogger.info('User authenticated successfully');
          authLogger.warn('Authentication attempt failed');
        }).not.toThrow();
      });

      it('should log with metadata', () => {
        expect(() => {
          authLogger.info('User login', { userId: 'user-123', ip: '192.168.1.1' });
        }).not.toThrow();
      });
    });

    describe('apiLogger', () => {
      it('should be defined', () => {
        expect(apiLogger).toBeDefined();
      });

      it('should have all log methods', () => {
        expect(typeof apiLogger.info).toBe('function');
        expect(typeof apiLogger.error).toBe('function');
        expect(typeof apiLogger.warn).toBe('function');
        expect(typeof apiLogger.debug).toBe('function');
      });

      it('should allow logging messages', () => {
        expect(() => {
          apiLogger.info('API request received');
          apiLogger.error('API error occurred');
        }).not.toThrow();
      });

      it('should log with metadata', () => {
        expect(() => {
          apiLogger.info('API request', { method: 'GET', path: '/api/users', status: 200 });
        }).not.toThrow();
      });
    });

    describe('appLogger', () => {
      it('should be defined', () => {
        expect(appLogger).toBeDefined();
      });

      it('should have all log methods', () => {
        expect(typeof appLogger.info).toBe('function');
        expect(typeof appLogger.error).toBe('function');
        expect(typeof appLogger.warn).toBe('function');
        expect(typeof appLogger.debug).toBe('function');
      });

      it('should allow logging messages', () => {
        expect(() => {
          appLogger.info('Application started');
          appLogger.error('Application error');
        }).not.toThrow();
      });

      it('should log with metadata', () => {
        expect(() => {
          appLogger.info('App event', { event: 'startup', port: 3000 });
        }).not.toThrow();
      });
    });
  });

  describe('logger behavior', () => {
    it('should handle error objects', () => {
      const error = new Error('Test error');
      expect(() => {
        dbLogger.error('Error occurred', { error });
      }).not.toThrow();
    });

    it('should handle different log levels', () => {
      expect(() => {
        apiLogger.debug('Debug message');
        apiLogger.info('Info message');
        apiLogger.warn('Warning message');
        apiLogger.error('Error message');
      }).not.toThrow();
    });

    it('should handle complex metadata', () => {
      const complexMetadata = {
        request: {
          method: 'POST',
          url: '/api/users',
          headers: { 'content-type': 'application/json' },
        },
        response: {
          status: 201,
          body: { id: 'user-123' },
        },
        timing: {
          start: Date.now(),
          duration: 123,
        },
      };

      expect(() => {
        apiLogger.info('Complex log entry', complexMetadata);
      }).not.toThrow();
    });

    it('should handle null and undefined values', () => {
      expect(() => {
        dbLogger.info('Test', { value: null, other: undefined });
      }).not.toThrow();
    });

    it('should handle empty messages', () => {
      expect(() => {
        authLogger.info('');
      }).not.toThrow();
    });

    it('should handle messages with special characters', () => {
      expect(() => {
        appLogger.info('Test message with "quotes" and \\backslashes\\');
      }).not.toThrow();
    });
  });

  describe('environment-specific behavior', () => {
    it('should create logger based on environment', () => {
      // Logger is created at module load time
      // Just verify it exists and works
      expect(dbLogger).toBeDefined();
      expect(authLogger).toBeDefined();
      expect(apiLogger).toBeDefined();
      expect(appLogger).toBeDefined();
    });

    it('should support different log levels based on environment', () => {
      // In test environment, all log levels should work
      expect(() => {
        dbLogger.debug('Debug level');
        dbLogger.info('Info level');
        dbLogger.warn('Warn level');
        dbLogger.error('Error level');
      }).not.toThrow();
    });
  });
});
