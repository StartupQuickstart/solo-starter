import { createChildLogger } from '../utils/logger';

/**
 * Configuration options for BaseService
 */
export interface BaseServiceConfig {
  /** Service name for logging and identification */
  name: string;
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Custom logger context */
  loggerContext?: Record<string, any>;
}

/**
 * Base service class that provides common functionality for all services
 *
 * Features:
 * - Singleton pattern support
 * - Structured logging with service context
 * - Initialization lifecycle management
 * - Error handling patterns
 * - Health check capabilities
 */
export abstract class BaseService {
  protected readonly serviceName: string;
  protected readonly logger: any;
  protected isInitialized = false;
  protected initializationError: Error | null = null;

  // Static singleton management
  private static instances = new Map<string, BaseService>();

  constructor(config: BaseServiceConfig) {
    this.serviceName = config.name;
    this.logger = createChildLogger({
      service: config.name,
      ...config.loggerContext,
    });

    if (config.debug) {
      this.logger.debug(`${this.serviceName} service created`);
    }
  }

  /**
   * Initialize the service
   * Override this method in derived classes to implement custom initialization
   */
  protected async initialize(): Promise<void> {
    // Default implementation - override in derived classes
    this.logger.debug(`${this.serviceName} service initializing`);
  }

  /**
   * Start the service with error handling and logging
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug(`${this.serviceName} service already initialized`);
      return;
    }

    try {
      this.logger.info(`Starting ${this.serviceName} service`);
      await this.initialize();
      this.isInitialized = true;
      this.initializationError = null;
      this.logger.info(`${this.serviceName} service started successfully`);
    } catch (error) {
      this.initializationError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to start ${this.serviceName} service`, {
        error: this.initializationError.message,
        stack: this.initializationError.stack,
      });
      throw this.initializationError;
    }
  }

  /**
   * Stop the service
   * Override this method in derived classes to implement custom cleanup
   */
  protected async shutdown(): Promise<void> {
    // Default implementation - override in derived classes
    this.logger.debug(`${this.serviceName} service shutting down`);
  }

  /**
   * Stop the service with error handling and logging
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.debug(`${this.serviceName} service not initialized, nothing to stop`);
      return;
    }

    try {
      this.logger.info(`Stopping ${this.serviceName} service`);
      await this.shutdown();
      this.isInitialized = false;
      this.logger.info(`${this.serviceName} service stopped successfully`);
    } catch (error) {
      const shutdownError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error stopping ${this.serviceName} service`, {
        error: shutdownError.message,
        stack: shutdownError.stack,
      });
      throw shutdownError;
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.initializationError === null;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    service: string;
    status: 'healthy' | 'unhealthy' | 'starting';
    initialized: boolean;
    error?: string;
    uptime?: number;
  }> {
    return {
      service: this.serviceName,
      status: this.isInitialized
        ? this.initializationError
          ? 'unhealthy'
          : 'healthy'
        : 'starting',
      initialized: this.isInitialized,
      error: this.initializationError?.message,
    };
  }

  /**
   * Get the service name
   */
  getName(): string {
    return this.serviceName;
  }

  /**
   * Get the service logger
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Handle errors consistently across services
   */
  protected handleError(error: unknown, operation: string): Error {
    const serviceError = error instanceof Error ? error : new Error(String(error));

    this.logger.error(`${this.serviceName} service error during ${operation}`, {
      error: serviceError.message,
      stack: serviceError.stack,
      operation,
    });

    return serviceError;
  }

  /**
   * Log service metrics or events
   */
  protected logMetric(metric: string, value: any, metadata?: Record<string, any>) {
    this.logger.info(`${this.serviceName} metric: ${metric}`, {
      metric,
      value,
      ...metadata,
    });
  }

  // Static singleton methods

  /**
   * Create or return existing service instance
   * @param serviceClass - The service class constructor
   * @param constructorArgs - Arguments to pass to the constructor
   * @returns The service instance
   */
  public static async createInstance<T extends BaseService>(
    this: new (...args: any[]) => T,
    ...constructorArgs: any[]
  ): Promise<T> {
    const className = this.name;

    // Check if instance already exists and is ready
    const existingInstance = BaseService.instances.get(className) as T;
    if (existingInstance && existingInstance.isReady()) {
      return existingInstance;
    }

    // Create new instance
    const newInstance = new this(...constructorArgs);
    BaseService.instances.set(className, newInstance);

    // Start the service
    await newInstance.start();

    return newInstance;
  }

  /**
   * Get existing service instance
   * @returns The service instance
   * @throws Error if not initialized
   */
  protected static getInstance<T extends BaseService>(this: new (...args: any[]) => T): T {
    const className = this.name;
    const instance = BaseService.instances.get(className) as T;

    if (!instance) {
      throw new Error(`${className} service not initialized. Call ${className}.create() first.`);
    }

    return instance;
  }

  /**
   * Check if service instance exists and is ready
   * @returns True if service is ready
   */
  protected static isServiceReady<T extends BaseService>(this: new (...args: any[]) => T): boolean {
    const className = this.name;
    const instance = BaseService.instances.get(className) as T;
    return instance?.isReady() ?? false;
  }

  /**
   * Reset service instance (useful for testing)
   */
  protected static async resetInstance<T extends BaseService>(
    this: new (...args: any[]) => T,
  ): Promise<void> {
    const className = this.name;
    const instance = BaseService.instances.get(className) as T;

    if (instance) {
      await instance.stop();
      BaseService.instances.delete(className);
    }
  }

  /**
   * Reset all service instances (useful for testing)
   */
  static async resetAllInstances(): Promise<void> {
    const stopPromises = Array.from(BaseService.instances.values()).map(instance =>
      instance.stop(),
    );
    await Promise.all(stopPromises);
    BaseService.instances.clear();
  }
}
