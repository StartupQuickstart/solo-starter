import { describe, it, expect } from 'vitest';

/**
 * Pins the package's runtime export surface.
 *
 * A name added to or removed from the root entry fails this test, so the
 * surface only changes on purpose: update the list in the same change.
 */
const EXPECTED_EXPORTS = [
  'AUTH_EXEMPT_PATHS',
  'AppConfigService',
  'AuthenticationError',
  'Backend',
  'BaseModel',
  'BaseService',
  'DatabaseService',
  'ERROR_CODE',
  'RATE_LIMITED_CODE',
  'REQUEST_ID_HEADER',
  'UserModel',
  'apiLogger',
  'appLogger',
  'auth',
  'authLogger',
  'autoProvisioningMiddleware',
  'clerkAuthProvider',
  'createChildLogger',
  'createDatabaseClient',
  'createDefaultAppConfig',
  'createEnhancedRequestLogger',
  'createErrorHandler',
  'createNotFoundHandler',
  'createPrismaClient',
  'createRateLimiter',
  'createRequestIdMiddleware',
  'createRequestLogger',
  'createSingletonPrismaClient',
  'dbLogger',
  'disconnectDatabase',
  'getAuthenticatedUser',
  'getDatabaseConfigFromEnv',
  'getRequestId',
  'isZodError',
  'logger',
  'performHealthCheck',
  'rateLimiters',
  'skipAuthExemptPaths',
  'testPrismaConnection',
  'withUserContext',
] as const;

describe('package export surface', () => {
  it('exports exactly the pinned names from the root entry', async () => {
    const root = await import('./index');
    expect(Object.keys(root).sort()).toEqual([...EXPECTED_EXPORTS].sort());
  });

  it('registers the Clerk and provisioning middleware when auth() is called', async () => {
    const { auth } = await import('./auth/index');
    const registered: unknown[] = [];
    const app = { use: (handler: unknown) => registered.push(handler) };

    const provider = auth(app as never, {});

    expect(registered).toHaveLength(2);
    expect(provider).toBeDefined();
  });

  it('answers 401 from AuthenticationError', async () => {
    const { AuthenticationError } = await import('./auth/index');
    const error = new AuthenticationError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(401);
  });
});
