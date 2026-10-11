import { PrismaClient } from '../generated/prisma';
import { Backend, DatabaseService } from '@app/backend';

/**
 * Module augmentation for the Express Application interface.
 * Narrows the `backend` property to this API's PrismaClient type
 * so downstream code gets full type-safety without casting.
 */
declare module 'express' {
  interface Application {
    backend?: Backend<PrismaClient>;
  }
}

/** Database service type parameterized with this API's Prisma client */
export type AppDatabaseService = DatabaseService<PrismaClient>;

/** Backend instance type parameterized with this API's Prisma client */
export type AppBackend = Backend<PrismaClient>;
