import { PrismaModel } from '@/models';
import { BaseService } from '@/services/base.service';
import { UserContext } from '@/utils';

// Define minimal Prisma client interface we need
export interface PrismaLikeClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<T>(
    operation: (tx: any) => Promise<T>,
    options?: {
      isolationLevel?: string;
      timeout?: number;
      maxWait?: number;
    },
  ): Promise<T>;
  $executeRaw(query: any, ...values: any[]): Promise<any>;
  [key: string]: PrismaModel | any;
}

/**
 * Database service class that manages Prisma client instances
 * Uses singleton pattern to ensure only one connection per application
 * @template T The Prisma client type
 */
export class DatabaseService<T extends PrismaLikeClient = PrismaLikeClient> extends BaseService {
  private static PrismaClientClass: any = null;
  public client: T | null = null;

  constructor(prismaClientClass?: any) {
    super({ name: 'database' });
    if (prismaClientClass) {
      DatabaseService.PrismaClientClass = prismaClientClass;
    }
  }

  /**
   * Initialize the database connection
   */
  protected async initialize(): Promise<void> {
    await super.initialize();

    if (!DatabaseService.PrismaClientClass) {
      throw new Error(
        'PrismaClient class not provided. Call DatabaseService.createInstance() with PrismaClient class.',
      );
    }

    // Create the Prisma client instance
    this.client = new DatabaseService.PrismaClientClass({
      log:
        process.env.NODE_ENV === 'development'
          ? ['error', 'warn', ...(process.env.PRISMA_LOG_LEVEL?.split(',') || ['info'])]
          : ['error'],
    });

    if (!this.client) {
      throw new Error('Failed to create Prisma client instance');
    }

    // Test the connection
    await this.client.$connect();

    this.logger.info('Database connection established successfully');
  }

  /**
   * Shutdown the database connection
   */
  protected async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.logger.info('Database connection closed');
    }
    await super.shutdown();
  }

  /**
   * Get the current Prisma client instance
   * @returns The Prisma client instance
   * @throws Error if not initialized
   */
  static getClient<T extends PrismaLikeClient = PrismaLikeClient>(): T | null {
    const instance = this.getInstance() as DatabaseService<T>;
    return instance.client;
  }

  /**
   * Gets whether the database is connected
   * @returns True if connected, false otherwise
   */
  public async isConnected(): Promise<boolean> {
    try {
      if (!this.client) {
        this.logger.warn('Prisma client not initialized');
        return false;
      }

      await this.client.$connect();
      this.logger.info('Database connection successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection failed', {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Execute a database operation with user context (for API compatibility)
   * Note: RLS has been removed, this now just executes the operation in a transaction
   * @param context The user context (retained for API compatibility)
   * @param operation The database operation to perform
   * @returns The result of the database operation
   */
  public async withUserContext<R>(
    _context: UserContext,
    operation: (tx: T) => Promise<R>,
  ): Promise<R> {
    if (!this.client) {
      throw new Error('Prisma client not initialized');
    }

    return this.client.$transaction(
      async (tx: T) => {
        // Execute the operation with the transaction instance
        return operation(tx);
      },
      {
        isolationLevel: 'ReadCommitted',
        timeout: 30000,
        maxWait: 10000,
      },
    );
  }

  /**
   * Create or return existing DatabaseService instance with proper typing
   * @param prismaClientClass - The Prisma client class constructor
   * @returns The typed DatabaseService instance
   */
  static async createTypedInstance<T extends PrismaLikeClient>(
    prismaClientClass: new (...args: any[]) => T,
  ): Promise<DatabaseService<T>> {
    const className = 'DatabaseService';

    // Check if instance already exists and is ready
    const existingInstance = BaseService['instances'].get(className) as DatabaseService<T>;
    if (existingInstance && existingInstance.isReady()) {
      return existingInstance;
    }

    // Create new instance
    const newInstance = new DatabaseService<T>(prismaClientClass);
    BaseService['instances'].set(className, newInstance);

    // Start the service
    await newInstance.start();

    return newInstance;
  }

  /**
   * Reset the database service (useful for testing)
   */
  static async reset() {
    await this.resetInstance();
    DatabaseService.PrismaClientClass = null;
  }
}
