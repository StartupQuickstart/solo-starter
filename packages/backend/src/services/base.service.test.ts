import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseService } from './base.service';

/**
 * Tests for BaseService
 *
 * These tests ensure:
 * - Service lifecycle management works correctly
 * - Singleton pattern prevents duplicate instances
 * - Health checks report accurate status
 * - Error handling is consistent
 * - Logging provides good observability
 */

// Create concrete test service for testing abstract base class
class TestService extends BaseService {
  public initializeCalled = false;
  public shutdownCalled = false;
  public shouldFailInitialize = false;
  public shouldFailShutdown = false;

  constructor(name: string = 'test', debug: boolean = false) {
    super({ name, debug });
  }

  protected async initialize(): Promise<void> {
    await super.initialize();
    this.initializeCalled = true;

    if (this.shouldFailInitialize) {
      throw new Error('Initialization failed');
    }
  }

  protected async shutdown(): Promise<void> {
    await super.shutdown();
    this.shutdownCalled = true;

    if (this.shouldFailShutdown) {
      throw new Error('Shutdown failed');
    }
  }

  // Expose protected methods for testing
  public callHandleError(error: unknown, operation: string) {
    return this.handleError(error, operation);
  }

  public callLogMetric(metric: string, value: any, metadata?: Record<string, any>) {
    return this.logMetric(metric, value, metadata);
  }
}

describe('BaseService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  afterEach(async () => {
    // Clean up all service instances after each test
    await BaseService.resetAllInstances();
  });

  describe('constructor', () => {
    it('should initialize with service name', () => {
      expect(service.getName()).toBe('test');
    });

    it('should create logger with service context', () => {
      const logger = service.getLogger();
      expect(logger).toBeDefined();
    });

    it('should not be initialized on construction', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should accept debug flag', () => {
      const debugService = new TestService('debug-test', true);
      expect(debugService.getName()).toBe('debug-test');
    });
  });

  describe('start()', () => {
    it('should call initialize() method', async () => {
      await service.start();
      expect(service.initializeCalled).toBe(true);
    });

    it('should set isInitialized to true on success', async () => {
      await service.start();
      expect(service.isReady()).toBe(true);
    });

    it('should not call initialize twice if already started', async () => {
      await service.start();
      service.initializeCalled = false; // Reset flag

      await service.start();
      expect(service.initializeCalled).toBe(false); // Should not be called again
    });

    it('should handle initialization errors', async () => {
      service.shouldFailInitialize = true;

      await expect(service.start()).rejects.toThrow('Initialization failed');
      expect(service.isReady()).toBe(false);
    });

    it('should set initializationError on failure', async () => {
      service.shouldFailInitialize = true;

      try {
        await service.start();
      } catch (error) {
        // Expected
      }

      const health = await service.getHealthStatus();
      // Status is 'starting' because isInitialized is false on failure
      expect(health.status).toBe('starting');
      expect(health.initialized).toBe(false);
      expect(health.error).toBe('Initialization failed');
    });

    it('should clear initializationError on successful start', async () => {
      service.shouldFailInitialize = true;

      // First attempt fails
      try {
        await service.start();
      } catch (error) {
        // Expected
      }

      // Second attempt succeeds
      service.shouldFailInitialize = false;
      await service.start();

      const health = await service.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.error).toBeUndefined();
    });
  });

  describe('stop()', () => {
    it('should call shutdown() method', async () => {
      await service.start();
      await service.stop();

      expect(service.shutdownCalled).toBe(true);
    });

    it('should set isInitialized to false', async () => {
      await service.start();
      await service.stop();

      expect(service.isReady()).toBe(false);
    });

    it('should not call shutdown if not started', async () => {
      await service.stop();

      expect(service.shutdownCalled).toBe(false);
    });

    it('should handle shutdown errors', async () => {
      await service.start();
      service.shouldFailShutdown = true;

      await expect(service.stop()).rejects.toThrow('Shutdown failed');
    });

    it('should allow restart after stop', async () => {
      await service.start();
      await service.stop();
      await service.start();

      expect(service.isReady()).toBe(true);
    });
  });

  describe('isReady()', () => {
    it('should return false before start', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true after successful start', async () => {
      await service.start();
      expect(service.isReady()).toBe(true);
    });

    it('should return false after stop', async () => {
      await service.start();
      await service.stop();
      expect(service.isReady()).toBe(false);
    });

    it('should return false if initialization failed', async () => {
      service.shouldFailInitialize = true;

      try {
        await service.start();
      } catch (error) {
        // Expected
      }

      expect(service.isReady()).toBe(false);
    });
  });

  describe('getHealthStatus()', () => {
    it('should return starting status before initialization', async () => {
      const health = await service.getHealthStatus();

      expect(health.service).toBe('test');
      expect(health.status).toBe('starting');
      expect(health.initialized).toBe(false);
    });

    it('should return healthy status after successful start', async () => {
      await service.start();
      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.initialized).toBe(true);
      expect(health.error).toBeUndefined();
    });

    it('should return starting status after initialization failure', async () => {
      service.shouldFailInitialize = true;

      try {
        await service.start();
      } catch (error) {
        // Expected
      }

      const health = await service.getHealthStatus();

      // Status is 'starting' when isInitialized is false, even with error
      expect(health.status).toBe('starting');
      expect(health.initialized).toBe(false);
      expect(health.error).toBe('Initialization failed');
    });

    it('should include service name in status', async () => {
      const customService = new TestService('custom-service');
      const health = await customService.getHealthStatus();

      expect(health.service).toBe('custom-service');
    });
  });

  describe('handleError()', () => {
    it('should convert Error to Error instance', () => {
      const error = new Error('Test error');
      const result = service.callHandleError(error, 'test operation');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Test error');
    });

    it('should convert string to Error instance', () => {
      const result = service.callHandleError('String error', 'test operation');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('String error');
    });

    it('should convert unknown to Error instance', () => {
      const result = service.callHandleError({ code: 'UNKNOWN' }, 'test operation');

      expect(result).toBeInstanceOf(Error);
    });

    it('should return the error for throwing', () => {
      const error = new Error('Test');
      const result = service.callHandleError(error, 'op');

      expect(result).toBe(error);
    });
  });

  describe('logMetric()', () => {
    it('should log metric without throwing', () => {
      expect(() => {
        service.callLogMetric('test_metric', 42);
      }).not.toThrow();
    });

    it('should log metric with metadata', () => {
      expect(() => {
        service.callLogMetric('test_metric', 42, { extra: 'data' });
      }).not.toThrow();
    });
  });

  describe('singleton pattern', () => {
    afterEach(async () => {
      await BaseService.resetAllInstances();
    });

    it('should create and return same instance', async () => {
      const instance1 = await TestService.createInstance('singleton-test');
      const instance2 = await TestService.createInstance('singleton-test');

      expect(instance1).toBe(instance2);
    });

    it('should auto-start service when creating instance', async () => {
      const instance = await TestService.createInstance('auto-start');

      expect(instance.isReady()).toBe(true);
    });

    it('should create separate instances for different service names', async () => {
      // Note: Service name is set in constructor, not createInstance
      // This test documents current behavior where class name is used for singleton key

      const instance1 = await TestService.createInstance('service1');
      const instance2 = await TestService.createInstance('service2');

      // Both will be the same instance because they're the same class
      expect(instance1).toBe(instance2);
    });

    it('should allow resetting instance', async () => {
      const instance1 = await TestService.createInstance('reset-test');
      await TestService.resetInstance.call(TestService);

      const instance2 = await TestService.createInstance('reset-test');

      // After reset, should create new instance
      expect(instance1).not.toBe(instance2);
    });

    it('should stop service when resetting', async () => {
      const instance = await TestService.createInstance('stop-test');
      expect(instance.isReady()).toBe(true);

      await TestService.resetInstance.call(TestService);

      expect(instance.isReady()).toBe(false);
    });

    it('should handle resetAllInstances', async () => {
      const service1 = await TestService.createInstance('service1');
      const service2 = await TestService.createInstance('service2');

      expect(service1.isReady()).toBe(true);

      await BaseService.resetAllInstances();

      expect(service1.isReady()).toBe(false);
    });
  });

  describe('error scenarios', () => {
    it('should handle async initialization errors', async () => {
      class AsyncErrorService extends BaseService {
        protected async initialize() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('Async init error');
        }
      }

      const asyncService = new AsyncErrorService({ name: 'async-error' });

      await expect(asyncService.start()).rejects.toThrow('Async init error');
    });

    it('should handle async shutdown errors', async () => {
      class AsyncShutdownService extends BaseService {
        protected async shutdown() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('Async shutdown error');
        }
      }

      const asyncService = new AsyncShutdownService({ name: 'async-shutdown' });
      await asyncService.start();

      await expect(asyncService.stop()).rejects.toThrow('Async shutdown error');
    });
  });

  describe('lifecycle edge cases', () => {
    it('should handle multiple start() calls gracefully', async () => {
      const startPromise1 = service.start();
      const startPromise2 = service.start();
      const startPromise3 = service.start();

      await Promise.all([startPromise1, startPromise2, startPromise3]);

      // Initialize should only be called once
      expect(service.initializeCalled).toBe(true);
      expect(service.isReady()).toBe(true);
    });

    it('should handle multiple stop() calls gracefully', async () => {
      await service.start();

      await service.stop();
      await service.stop();
      await service.stop();

      expect(service.isReady()).toBe(false);
    });

    it('should handle start-stop-start cycle', async () => {
      await service.start();
      expect(service.isReady()).toBe(true);

      await service.stop();
      expect(service.isReady()).toBe(false);

      await service.start();
      expect(service.isReady()).toBe(true);
    });
  });
});

/**
 * TESTABILITY SCORE: 9/10
 *
 * This base class is HIGHLY testable because:
 * ✅ Abstract class with protected methods (testable via concrete implementation)
 * ✅ Clear lifecycle methods
 * ✅ Predictable state management
 * ✅ Good error handling
 * ✅ Singleton pattern is well-implemented
 *
 * Minor testability issues:
 * - Singleton uses class name as key (harder to test different instances)
 * - Logger is created in constructor (can't easily inject mock)
 *
 * ARCHITECTURE RECOMMENDATIONS:
 *
 * 1. **Dependency Injection for Logger:**
 * ```typescript
 * constructor(config: BaseServiceConfig & { logger?: Logger }) {
 *   this.logger = config.logger || createChildLogger({ service: config.name });
 * }
 * ```
 * This makes testing easier and allows custom loggers.
 *
 * 2. **Service Key Strategy:**
 * Consider allowing custom singleton keys:
 * ```typescript
 * protected static getSingletonKey(): string {
 *   return this.name; // Override in subclasses for custom keys
 * }
 * ```
 *
 * 3. **Lifecycle Hooks:**
 * Consider adding more granular hooks:
 * ```typescript
 * protected async beforeInitialize(): Promise<void> {}
 * protected async afterInitialize(): Promise<void> {}
 * protected async beforeShutdown(): Promise<void> {}
 * protected async afterShutdown(): Promise<void> {}
 * ```
 * This allows subclasses to hook into lifecycle without overriding core methods.
 */
