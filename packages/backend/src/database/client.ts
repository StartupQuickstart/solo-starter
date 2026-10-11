/**
 * Database client utilities and configuration
 * Generic functions that work with any database client (Prisma, Drizzle, etc.)
 */
import type { DatabaseConfig, HealthCheckResult } from './types';
import { dbLogger } from '@/utils/logger';

/**
 * Get database configuration from environment variables
 * @returns Database configuration object
 */
export function getDatabaseConfigFromEnv(): DatabaseConfig {
  return {
    databaseUrl: process.env.DATABASE_URL,
    log: process.env.DB_LOG ? 
      process.env.DB_LOG.split(',') as ('query' | 'info' | 'warn' | 'error')[] : 
      ['error'],
    errorFormat: (process.env.DB_ERROR_FORMAT as 'pretty' | 'colorless' | 'minimal') || 'colorless'
  };
}

/**
 * Creates a configured database client instance
 * Generic function that works with any ORM client class
 * 
 * @param ClientClass - Your database client class (PrismaClient, DrizzleClient, etc.)
 * @param config - Optional configuration overrides
 * @returns Configured database client instance
 */
export function createDatabaseClient<T>(
  ClientClass: new (config?: any) => T,
  config?: DatabaseConfig
): T {
  const envConfig = getDatabaseConfigFromEnv();
  const finalConfig = { ...envConfig, ...config };

  const clientConfig: any = { ...finalConfig.clientOptions };
  
  // Handle Prisma-style configuration
  if (finalConfig.databaseUrl) {
    clientConfig.datasources = {
      db: {
        url: finalConfig.databaseUrl
      }
    };
  }

  if (finalConfig.log) {
    clientConfig.log = finalConfig.log;
  }

  if (finalConfig.errorFormat) {
    clientConfig.errorFormat = finalConfig.errorFormat;
  }

  return new ClientClass(clientConfig);
}

/**
 * Performs a health check on the database connection
 * Works with any client that has a $queryRaw method (like Prisma)
 * @param databaseClient - Your database client instance
 * @returns Health check result
 */
export async function performHealthCheck(databaseClient: any): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Try to execute a simple query
    if (typeof databaseClient.$queryRaw === 'function') {
      await databaseClient.$queryRaw`SELECT 1`;
    } else if (typeof databaseClient.execute === 'function') {
      await databaseClient.execute('SELECT 1');
    } else {
      throw new Error('Unsupported database client - no query method found');
    }
    
    const responseTime = Date.now() - startTime;
    
    // Try to get database version
    let version: string | undefined;
    try {
      let result;
      if (typeof databaseClient.$queryRaw === 'function') {
        result = await databaseClient.$queryRaw`SELECT VERSION()`;
      } else if (typeof databaseClient.execute === 'function') {
        result = await databaseClient.execute('SELECT VERSION()');
      }
      
      if (Array.isArray(result) && result.length > 0) {
        version = Object.values(result[0])[0] as string;
      }
    } catch {
      // Version query might fail on some databases, that's okay
    }

    return {
      connected: true,
      responseTime,
      version
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Safely disconnect from the database
 * Works with any client that has a disconnect method
 * @param databaseClient - Your database client instance
 */
export async function disconnectDatabase(databaseClient: any): Promise<void> {
  try {
    if (typeof databaseClient.$disconnect === 'function') {
      await databaseClient.$disconnect();
    } else if (typeof databaseClient.close === 'function') {
      await databaseClient.close();
    } else if (typeof databaseClient.destroy === 'function') {
      await databaseClient.destroy();
    }
  } catch (error) {
    dbLogger.warn('Error disconnecting from database', { 
      error: error instanceof Error ? error.message : error 
    });
  }
}