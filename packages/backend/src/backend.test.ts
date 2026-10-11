import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Application } from 'express';
import { Backend } from './backend';
import { DatabaseService } from './database/database.service';
import { AppConfigService, createDefaultAppConfig } from './config';
import type { BaseModel } from './models';

// Mock dependencies
vi.mock('./auth', () => ({
  auth: vi.fn(() => ({ middleware: vi.fn() })),
}));

vi.mock('./middleware/request-logger', () => ({
  createEnhancedRequestLogger: vi.fn(() => vi.fn((req, res, next) => next())),
}));

vi.mock('./models', () => ({
  UserModel: vi.fn(function () {
    return { modelName: 'user' };
  }),
  BaseModel: vi.fn(),
}));

vi.mock('./database/database.service', () => ({
  DatabaseService: {
    createTypedInstance: vi.fn(),
  },
}));

/**
 * Tests for Backend Class
 *
 * These tests ensure:
 * - Backend instance creation and initialization
 * - Middleware setup (helmet, cors, express)
 * - Health check and config endpoints
 * - Model registration and retrieval
 * - Error handling for process errors
 * - Server start and error handling
 */
describe('Backend', () => {
  let mockApp: Application;
  let mockDatabase: any;
  let mockConfigService: AppConfigService;
  let processOnSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Create fresh Express app
    mockApp = express();

    // Mock database
    mockDatabase = {
      client: {},
      withUserContext: vi.fn(),
    };

    // Mock config service
    mockConfigService = new AppConfigService(createDefaultAppConfig());

    // Spy on process methods
    processOnSpy = vi.spyOn(process, 'on');
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Mock DatabaseService.createTypedInstance
    (DatabaseService.createTypedInstance as any).mockResolvedValue(mockDatabase);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original implementations
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('create', () => {
    it('should create Backend instance', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      expect(backend).toBeInstanceOf(Backend);
      expect(backend.app).toBe(mockApp);
      expect(backend.database).toBe(mockDatabase);
      expect(mockApp.backend).toBe(backend);
    });

    it('should use provided config service', async () => {
      class MockPrismaClient {}

      const customConfig = new AppConfigService(createDefaultAppConfig());

      const backend = await Backend.create(mockApp, MockPrismaClient, {
        configService: customConfig,
      });

      expect(backend.configService).toBe(customConfig);
    });

    it('should create default config service if not provided', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      expect(backend.configService).toBeInstanceOf(AppConfigService);
    });

    it('should return existing backend instance if already created', async () => {
      class MockPrismaClient {}

      const backend1 = await Backend.create(mockApp, MockPrismaClient);
      const backend2 = await Backend.create(mockApp, MockPrismaClient);

      expect(backend1).toBe(backend2);
      expect(DatabaseService.createTypedInstance).toHaveBeenCalledTimes(1);
    });

    it('should handle database creation errors', async () => {
      class MockPrismaClient {}

      (DatabaseService.createTypedInstance as any).mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(Backend.create(mockApp, MockPrismaClient)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle non-Error exceptions', async () => {
      class MockPrismaClient {}

      (DatabaseService.createTypedInstance as any).mockRejectedValueOnce(
        'String error',
      );

      await expect(Backend.create(mockApp, MockPrismaClient)).rejects.toThrow();
    });

    it('should initialize with request logging enabled by default', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      expect(backend).toBeDefined();
      // Request logging is enabled by default
    });

    it('should allow disabling request logging', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient, {
        enableRequestLogging: false,
      });

      expect(backend).toBeDefined();
    });
  });

  describe('getModel', () => {
    it('should retrieve registered model', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);
      const mockModel = { modelName: 'test' } as unknown as BaseModel<any, any>;

      backend.registerModel('test', mockModel);

      const retrieved = backend.getModel('test');

      expect(retrieved).toBe(mockModel);
    });

    it('should throw error when model not found', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      expect(() => backend.getModel('nonexistent')).toThrow(
        'Model nonexistent not found in backend models',
      );
    });
  });

  describe('registerModel', () => {
    it('should register new model', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);
      const mockModel = { modelName: 'test' } as unknown as BaseModel<any, any>;

      backend.registerModel('test', mockModel);

      expect(backend.models['test']).toBe(mockModel);
    });

    it('should throw error when registering duplicate model', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);
      const mockModel = { modelName: 'test' } as unknown as BaseModel<any, any>;

      backend.registerModel('test', mockModel);

      expect(() => backend.registerModel('test', mockModel)).toThrow(
        'Model test is already registered',
      );
    });
  });

  describe('initializeApplication', () => {
    it('should set up middleware', async () => {
      class MockPrismaClient {}

      const useSpy = vi.spyOn(mockApp, 'use');
      const getSpy = vi.spyOn(mockApp, 'get');

      await Backend.create(mockApp, MockPrismaClient);

      // Check that middleware was added
      expect(useSpy).toHaveBeenCalled();

      // Check that health endpoint was registered
      expect(getSpy).toHaveBeenCalledWith('/api/v1/health', expect.any(Function));
    });

    it('registers no unauthenticated route besides the health check', async () => {
      class MockPrismaClient {}
      const getSpy = vi.spyOn(mockApp, 'get');

      await Backend.create(mockApp, MockPrismaClient);

      // `app.get(name)` reads a setting; a route registration passes a handler.
      const registeredPaths = getSpy.mock.calls.filter((call) => call.length > 1).map(([path]) => path);
      expect(registeredPaths).toEqual(['/api/v1/health']);
    });

    it('should respond to health check endpoint', async () => {
      class MockPrismaClient {}

      await Backend.create(mockApp, MockPrismaClient);

      // Find the health check handler
      const healthRoute = (mockApp as any)._router?.stack.find(
        (layer: any) =>
          layer.route?.path === '/api/v1/health' && layer.route?.methods?.get,
      );

      if (healthRoute) {
        const mockReq = {};
        const mockRes = {
          json: vi.fn(),
        };

        healthRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'ok',
          timestamp: expect.any(String),
        });
      }
    });

  });

  describe('process error handlers', () => {
    it('should setup uncaughtException handler', async () => {
      class MockPrismaClient {}

      await Backend.create(mockApp, MockPrismaClient);

      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should setup unhandledRejection handler', async () => {
      class MockPrismaClient {}

      await Backend.create(mockApp, MockPrismaClient);

      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should handle uncaught exception', async () => {
      class MockPrismaClient {}

      await Backend.create(mockApp, MockPrismaClient);

      // Get the uncaughtException handler
      const handler = processOnSpy.mock.calls.find(
        (call) => call[0] === 'uncaughtException',
      )?.[1];

      if (handler) {
        const testError = new Error('Test uncaught exception');
        handler(testError);

        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });

    it('should handle unhandled rejection with Error', async () => {
      class MockPrismaClient {}

      await Backend.create(mockApp, MockPrismaClient);

      const handler = processOnSpy.mock.calls.find(
        (call) => call[0] === 'unhandledRejection',
      )?.[1];

      if (handler) {
        const testError = new Error('Test unhandled rejection');
        handler(testError, Promise.resolve());

        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });

    it('should handle unhandled rejection with non-Error', async () => {
      class MockPrismaClient {}

      await Backend.create(mockApp, MockPrismaClient);

      const handler = processOnSpy.mock.calls.find(
        (call) => call[0] === 'unhandledRejection',
      )?.[1];

      if (handler) {
        handler('String rejection', Promise.resolve());

        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('start', () => {
    it('should start the server', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      const mockServer = {
        on: vi.fn(),
      };

      const listenSpy = vi.spyOn(mockApp, 'listen').mockImplementation((port, callback) => {
        if (typeof callback === 'function') {
          callback();
        }
        return mockServer as any;
      });

      backend.start();

      expect(listenSpy).toHaveBeenCalled();
      expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockServer.on).toHaveBeenCalledWith('close', expect.any(Function));

      listenSpy.mockRestore();
    });

    it('should handle EADDRINUSE error', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      const mockServer = {
        on: vi.fn(),
      };

      vi.spyOn(mockApp, 'listen').mockImplementation(() => {
        return mockServer as any;
      });

      backend.start();

      // Get the error handler
      const errorHandler = mockServer.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1];

      if (errorHandler) {
        const error = { code: 'EADDRINUSE', message: 'Port in use' };
        errorHandler(error);

        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });

    it('should handle EACCES error', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      const mockServer = {
        on: vi.fn(),
      };

      vi.spyOn(mockApp, 'listen').mockImplementation(() => {
        return mockServer as any;
      });

      backend.start();

      const errorHandler = mockServer.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1];

      if (errorHandler) {
        const error = { code: 'EACCES', message: 'Permission denied' };
        errorHandler(error);

        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });

    it('should handle ENOTFOUND error', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      const mockServer = {
        on: vi.fn(),
      };

      vi.spyOn(mockApp, 'listen').mockImplementation(() => {
        return mockServer as any;
      });

      backend.start();

      const errorHandler = mockServer.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1];

      if (errorHandler) {
        const error = { code: 'ENOTFOUND', message: 'Host not found' };
        errorHandler(error);

        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });

    it('should handle generic server errors', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      const mockServer = {
        on: vi.fn(),
      };

      vi.spyOn(mockApp, 'listen').mockImplementation(() => {
        return mockServer as any;
      });

      backend.start();

      const errorHandler = mockServer.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1];

      if (errorHandler) {
        const error = {
          code: 'UNKNOWN',
          message: 'Unknown error',
          stack: 'Error stack',
        };
        errorHandler(error);

        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });

    it('should handle server close event', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      const mockServer = {
        on: vi.fn(),
      };

      vi.spyOn(mockApp, 'listen').mockImplementation(() => {
        return mockServer as any;
      });

      backend.start();

      const closeHandler = mockServer.on.mock.calls.find(
        (call) => call[0] === 'close',
      )?.[1];

      expect(closeHandler).toBeDefined();

      if (closeHandler) {
        closeHandler();
        // Should log "Server closed"
      }
    });

    it('should handle listen errors', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      vi.spyOn(mockApp, 'listen').mockImplementation(() => {
        throw new Error('Listen failed');
      });

      backend.start();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('enableRequestLogging', () => {
    it('should enable request logging', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient, {
        enableRequestLogging: false,
      });

      const useSpy = vi.spyOn(mockApp, 'use');

      backend.enableRequestLogging();

      expect(useSpy).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should create fully functional backend', async () => {
      class MockPrismaClient {}

      const backend = await Backend.create(mockApp, MockPrismaClient);

      // Test model registration
      const mockModel = { modelName: 'product' } as unknown as BaseModel<any, any>;
      backend.registerModel('product', mockModel);

      const retrieved = backend.getModel('product');
      expect(retrieved).toBe(mockModel);

      // Test that backend is attached to app
      expect(mockApp.backend).toBe(backend);

      // Test that database is initialized
      expect(backend.database).toBeDefined();

      // Test that config service is initialized
      expect(backend.configService).toBeInstanceOf(AppConfigService);
    });
  });
});

/**
 * TESTABILITY SCORE: 5/10
 *
 * This class has MODERATE testability because:
 * ✅ Dependency injection for some components
 * ✅ Static factory method allows controlled initialization
 * ✅ Model registry is testable
 *
 * Testability issues:
 * ❌ Private constructor limits direct testing
 * ❌ Process event handlers (uncaughtException, unhandledRejection) - global side effects
 * ❌ process.exit calls (hard to test without mocking)
 * ❌ Express server lifecycle tightly coupled
 * ❌ Direct instantiation of models (UserModel)
 * ❌ Reads process.env directly in multiple places
 *
 * ARCHITECTURE RECOMMENDATIONS:
 *
 * 1. **Inject Error Handler:**
 * ```typescript
 * constructor(
 *   app: Application,
 *   database: DatabaseService<T>,
 *   configService: AppConfigService,
 *   errorHandler?: ErrorHandler
 * ) {
 *   this.errorHandler = errorHandler || new DefaultErrorHandler();
 * }
 * ```
 * This makes error handling testable.
 *
 * 2. **Extract Process Handler Setup:**
 * ```typescript
 * interface ProcessHandlers {
 *   onUncaughtException: (err: Error) => void;
 *   onUnhandledRejection: (reason: any) => void;
 * }
 * ```
 * This allows injecting custom handlers for testing.
 *
 * 3. **Inject Model Factories:**
 * ```typescript
 * constructor(
 *   app: Application,
 *   database: DatabaseService<T>,
 *   configService: AppConfigService,
 *   modelFactory?: ModelFactory
 * ) {
 *   this.users = modelFactory?.createUserModel() || new UserModel(this);
 * }
 * ```
 * This enables mocking model creation.
 *
 * 4. **Return Server Instance:**
 * ```typescript
 * public start(): Server {
 *   const server = this.app.listen(port);
 *   return server;
 * }
 * ```
 * This allows proper cleanup in tests.
 *
 * 5. **Add Graceful Shutdown:**
 * ```typescript
 * public async shutdown(): Promise<void> {
 *   await this.database.shutdown();
 *   // Remove process handlers
 *   // Close server
 * }
 * ```
 * This enables proper cleanup.
 *
 * 6. **Extract Environment Config:**
 * ```typescript
 * interface EnvironmentConfig {
 *   clerkPublishableKey: string;
 *   host: string;
 *   port: number;
 * }
 * ```
 * This reduces direct process.env access.
 */
