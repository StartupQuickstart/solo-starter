import cors from 'cors';
import type { Application } from 'express';
import express from 'express';
import helmet from 'helmet';
import type { Server as HTTPServer } from 'http';
import { createErrorHandler, createNotFoundHandler } from './server/error-handling';
import { auth } from './auth';
import { AuthProvider } from './auth/auth-provider';
import { AppConfigService, createDefaultAppConfig } from './config';
import { DatabaseService, PrismaLikeClient } from './database/database.service';
import { createRateLimiter } from './middleware/rate-limit';
import { createRequestIdMiddleware, REQUEST_ID_HEADER } from './middleware/request-id';
import { createEnhancedRequestLogger } from './middleware/request-logger';
import { BaseModel, UserModel } from './models';
import { appLogger } from './utils';

declare global {
  namespace Express {
    interface Application {
      backend?: Backend<any>;
    }
  }
}

/**
 *
 * Main Backend class that initializes and configures the Express application
 * with database, authentication, and middleware support
 */
export class Backend<T extends PrismaLikeClient = PrismaLikeClient> {
  app: Application;
  database: DatabaseService<T>;
  users: UserModel;
  auth: AuthProvider;
  configService: AppConfigService;

  models: { [key: string]: BaseModel<T, any> } = {};

  /**
   * Setup global process error handlers
   * Handles uncaught exceptions and unhandled promise rejections
   */
  private setupProcessErrorHandlers() {
    process.on('uncaughtException', err => {
      appLogger.error('Uncaught exception', { error: err.message, stack: err.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, _promise) => {
      appLogger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      process.exit(1);
    });
  }

  private constructor(
    app: Application,
    database: DatabaseService<T>,
    configService: AppConfigService,
    options: { enableRequestLogging?: boolean } = {},
  ) {
    this.app = app;
    this.database = database;
    this.configService = configService;
    app.backend = this;

    // Setup process error handlers first
    this.setupProcessErrorHandlers();

    this.users = new UserModel(this);
    this.auth = auth(app, this.users);

    // Add request logging after other setup (can be disabled)
    // First, so every later middleware, the request log line included, runs
    // inside the request's id.
    this.app.use(createRequestIdMiddleware());

    if (options.enableRequestLogging !== false) {
      this.enableRequestLogging();
    }

    // Initialize application with common middleware
    this.initializeApplication();
  }

  /**
   * Initialize application with common middleware
   * Called automatically in constructor
   * Can be called manually if needed
   */
  initializeApplication() {
    const serverConfig = this.configService.getServerConfig();

    // Basic middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    if (serverConfig.helmet) {
      this.app.use(helmet(serverConfig.helmet));
    } else {
      this.app.use(helmet());
    }

    // Use CORS configuration from app config
    this.app.use(
      cors({
        origin: serverConfig.cors.origin,
        credentials: serverConfig.cors.credentials,
        methods: serverConfig.cors.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: serverConfig.cors.allowedHeaders || ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
        // Lets a browser client read the id, to quote it when reporting a problem.
        exposedHeaders: [REQUEST_ID_HEADER],
        maxAge: 600,
      }),
    );

    // Apply rate limiting to API routes
    // Default: 1000 requests per 15 minutes per IP (permissive for mobile apps)
    // Can be configured via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX env vars
    const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
    const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '1000', 10);

    this.app.use(
      '/api',
      createRateLimiter({
        windowMs: rateLimitWindowMs,
        max: rateLimitMax,
      }),
    );

    // Health check
    this.app.get('/api/v1/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

  }

  /**
   * Enable request logging middleware
   * Can be called manually if disabled in constructor
   */
  enableRequestLogging() {
    this.app.use(createEnhancedRequestLogger());
  }

  /**
   * Setup Express error handling middleware
   * IMPORTANT: This must be called AFTER all routes are registered
   * It sets up 404 handler for undefined routes and global error handler
   *
   * @example
   * const backend = await Backend.create(app, PrismaClient);
   * // ... register all routes here ...
   * backend.setupErrorHandling();
   * backend.start();
   */
  setupErrorHandling() {
    // 404 handler for undefined routes
    this.app.use('/api/v1', createNotFoundHandler());

    // Global error handler (must be last)
    this.app.use(createErrorHandler());
  }

  /**
   * Create a new Backend instance with database connection
   * @param app - Express application instance
   * @param prismaClientClass - Prisma client class to instantiate
   * @param options - Configuration options
   * @returns Promise resolving to Backend instance
   */
  static async create<T extends PrismaLikeClient>(
    app: Application,
    prismaClientClass: new (...args: any[]) => T,
    options?: { enableRequestLogging?: boolean; configService?: AppConfigService },
  ): Promise<Backend<T>> {
    try {
      if (!app.backend) {
        appLogger.info('Creating Backend instance...');

        // Use provided configService or create a default one
        const configService =
          options?.configService || new AppConfigService(createDefaultAppConfig());

        appLogger.info('Initializing database connection...');
        const database = await DatabaseService.createTypedInstance(prismaClientClass);

        appLogger.info('Backend instance created successfully');
        app.backend = new Backend<T>(app, database, configService, options);
      }
      return app.backend;
    } catch (error) {
      appLogger.error('Failed to create Backend instance', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get a registered model by name
   * @param name - Model name
   * @returns Model instance
   */
  public getModel<M extends BaseModel<T, any>>(name: string): M {
    const model = this.models[name] as M;
    if (!model) {
      throw new Error(`Model ${name} not found in backend models`);
    }
    return model;
  }

  /**
   * Register a model with the backend
   * @param name - Model name
   * @param model - Model instance
   */
  public registerModel(name: string, model: BaseModel<T, any>) {
    if (this.models[name]) {
      throw new Error(`Model ${name} is already registered`);
    }
    this.models[name] = model;
  }

  /**
   * Start the Express application
   * @remarks This method starts the server listening on the configured port and host.
   * It should be called after all routes and middleware have been set up.
   * @returns The HTTP server instance for attaching additional handlers
   */
  public start(): HTTPServer {
    const { port, host } = this.configService.getServerConfig();

    appLogger.info('Starting server...', { host, port });

    try {
      const server = this.app.listen(port, () => {
        appLogger.info('API server started successfully', {
          host,
          port,
          url: `http://${host}:${port}`,
        });

        // Log enabled features
        const features = this.configService.getFeatures();
        const enabledFeatures = Object.entries(features)
          .filter(([_, config]) => config.enabled)
          .map(([name]) => name);

        if (enabledFeatures.length > 0) {
          appLogger.info('Features enabled', { features: enabledFeatures });
        }
      });

      // Handle server errors
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          appLogger.error('Port already in use', {
            port,
            host,
            message: 'Stop the other server or change the PORT env variable',
          });
        } else if (err.code === 'EACCES') {
          appLogger.error('Permission denied', {
            port,
            host,
            message: 'Try running with sudo or use a port > 1024',
          });
        } else if (err.code === 'ENOTFOUND') {
          appLogger.error('Host not found', {
            host,
            message: 'Check your HOST environment variable',
          });
        } else {
          appLogger.error('Server error', {
            error: err.message,
            code: err.code,
            stack: err.stack,
          });
        }
        process.exit(1);
      });

      // Handle server close
      server.on('close', () => {
        appLogger.info('Server closed');
      });

      return server;
    } catch (err: any) {
      appLogger.error('Failed to start server', {
        error: err.message,
        stack: err.stack,
        host,
        port,
      });
      process.exit(1);
    }
  }
}
