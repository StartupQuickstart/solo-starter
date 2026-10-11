/**
 * Database module
 * Provides database-agnostic utilities for any ORM
 *
 * @example
 * ```typescript
 * import { createDatabaseClient, performHealthCheck } from '@app/backend/database';
 * // or
 * import { createDatabaseClient, performHealthCheck } from '@app/backend';
 * ```
 */

// Core types and utilities
export * from './client';
export * from './types';

// Prisma-specific utilities
export * from './prisma';

// Database service
export * from './database.service';
