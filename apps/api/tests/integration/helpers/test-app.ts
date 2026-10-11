/**
 * Test application builder for integration tests.
 *
 * Mounts the REAL v1 router (`createV1Router`) and the real error handlers,
 * so route order, the owner filter, the subscription gate and the response
 * envelope are the ones production runs. Only what talks to Clerk is replaced:
 *
 * - authentication: `stubAuthMiddleware` resolves a test token to a seeded user
 * - webhook signatures: the event is the request body
 *
 * @module tests/integration/helpers/test-app
 */

import { createErrorHandler, createNotFoundHandler } from '@app/backend';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import type { PrismaClient } from '../../../generated/prisma';
import { createV1Router, PUBLIC_PATHS, type V1RouterDeps } from '../../../src/api/v1/index';
import type { ClerkWebhookVerifier } from '../../../src/api/v1/webhooks/clerk/clerk.routes';
import type { SeedUser } from './seed';
import { stubAuthMiddleware } from './stub-auth';

/**
 * Stand-in for the session check. `stubAuthMiddleware` has already resolved
 * the token; a request it could not resolve has no provisioned user.
 */
function requireAuthStub(req: Request, res: Response, next: NextFunction): void {
  if (!req.provisioned?.user?.id) {
    res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }
  next();
}

/** Stand-in for signature verification: the event is the request body as sent. */
export const trustBody: ClerkWebhookVerifier = async (req) =>
  JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body));

/** The web client origin the test app is configured with. */
export const TEST_APP_URL = 'https://app.example.com';

/** The plan name the test app is configured with. */
export const TEST_PLAN_NAME = 'Pro';

/** Options for building the test Express app. */
export interface BuildTestAppOptions {
  /** Connected Prisma client pointing at the test database. */
  readonly prisma: PrismaClient;
  /** Users whose tokens the stub middleware accepts. */
  readonly knownUsers: readonly SeedUser[];
  /** Replace any router dependency (for example billing, or the clock). */
  readonly overrides?: Partial<V1RouterDeps>;
}

/**
 * Build an Express app around the real v1 router for integration testing.
 *
 * @param opts - The test database client, the seeded users and optional fakes
 * @returns The app; hand it to supertest
 */
export function buildTestApp(opts: BuildTestAppOptions): Application {
  const { prisma, knownUsers, overrides = {} } = opts;

  const app = express();

  // Same order as src/index.ts: raw bodies for the webhooks, then JSON.
  for (const path of Object.values(PUBLIC_PATHS)) {
    app.use(path, express.raw({ type: 'application/json', limit: '1mb' }));
  }
  app.use(express.json());

  // Resolves test tokens for every route, public ones included.
  app.use(stubAuthMiddleware(...knownUsers));

  app.use(
    createV1Router({
      prisma,
      requireAuth: requireAuthStub,
      clerkWebhook: { signingSecret: undefined, verify: trustBody },
      // Billing is off unless a test passes a gateway.
      billing: { stripe: undefined, planName: TEST_PLAN_NAME, appUrl: TEST_APP_URL },
      ...overrides,
    }),
  );

  app.use('/api/v1', createNotFoundHandler());
  app.use(createErrorHandler());

  return app;
}
