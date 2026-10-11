/**
 * Database module types
 */

/**
 * Generic database client configuration
 */
export interface DatabaseConfig {
  /** Database URL - defaults to DATABASE_URL env var */
  databaseUrl?: string;
  /** Enable query logging */
  log?: ('query' | 'info' | 'warn' | 'error')[];
  /** Custom error format */
  errorFormat?: 'pretty' | 'colorless' | 'minimal';
  /** Additional client-specific options */
  clientOptions?: Record<string, any>;
}

/**
 * Database connection health check result
 */
export interface HealthCheckResult {
  /** Whether the database is connected */
  connected: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Database version info */
  version?: string;
  /** Any error message */
  error?: string;
}

