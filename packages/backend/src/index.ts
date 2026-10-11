/**
 * @app/backend
 *
 * The shared foundation the API boots from: the Express bootstrap, Clerk
 * authentication and user provisioning, configuration, logging and the error
 * handlers.
 */

export * from './server';

export * from './backend';

// Re-export modules
export * from './auth';
export * from './config';
export * from './database';
export * from './middleware';
export * from './models';
export * from './services';
export * from './types';
export * from './utils';
