/**
 * Route inventory: every endpoint of the API and who may call it.
 *
 * The inventory below is the single list of what the API exposes. Two things
 * keep it honest:
 *
 *  1. The real router is walked and every route found in it must be in the
 *     inventory. Adding a route without declaring its access fails the suite.
 *  2. Each declared route is called without a session and with one, and must
 *     answer the status its access level promises.
 *
 * Access levels:
 *   public    answers without a session (the health check; signed webhooks)
 *   signedIn  needs a session; it then works on the caller's own rows only
 *             (notes.integration.test.ts proves the "own rows only" half)
 *
 * @module tests/integration/route-inventory.test
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Router } from 'express';
import supertest, { type Response as SuperResponse } from 'supertest';
import type { PrismaClient } from '../../generated/prisma';
import { createV1Router } from '../../src/api/v1/index';
import { authHeader, seedUser, truncateAll, type SeedUser } from './helpers/seed';
import { buildTestApp } from './helpers/test-app';
import { connectToTestDatabase, DATABASE_URL_TEST } from './helpers/test-database';

const ACCESS = {
  public: 'public',
  signedIn: 'signedIn',
} as const;
type Access = (typeof ACCESS)[keyof typeof ACCESS];

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RouteEntry {
  readonly method: Method;
  /** The path as the feature router registers it (what the router walk finds). */
  readonly leaf: string;
  /** A concrete URL for the route. */
  readonly url: string;
  readonly access: Access;
}

/** Every route the API serves. */
const ROUTES: readonly RouteEntry[] = [
  // Public
  { method: 'GET', leaf: '/health', url: '/health', access: ACCESS.public },
  { method: 'GET', leaf: '/api/v1/health', url: '/api/v1/health', access: ACCESS.public },
  { method: 'POST', leaf: '/', url: '/api/webhooks/clerk', access: ACCESS.public },
  { method: 'POST', leaf: '/', url: '/api/webhooks/stripe', access: ACCESS.public },

  // EXAMPLE: notes. The six entries below.
  // Signed in: notes, the example feature
  { method: 'GET', leaf: '/', url: '/api/v1/notes', access: ACCESS.signedIn },
  { method: 'POST', leaf: '/', url: '/api/v1/notes', access: ACCESS.signedIn },
  // For subscribers. A signed-in user without a subscription is answered 403 SUBSCRIPTION_REQUIRED.
  { method: 'GET', leaf: '/export', url: '/api/v1/notes/export', access: ACCESS.signedIn },
  { method: 'GET', leaf: '/:noteId', url: '/api/v1/notes/note_any', access: ACCESS.signedIn },
  { method: 'PATCH', leaf: '/:noteId', url: '/api/v1/notes/note_any', access: ACCESS.signedIn },
  { method: 'DELETE', leaf: '/:noteId', url: '/api/v1/notes/note_any', access: ACCESS.signedIn },

  // Signed in: billing
  { method: 'GET', leaf: '/', url: '/api/v1/billing', access: ACCESS.signedIn },
  { method: 'POST', leaf: '/checkout', url: '/api/v1/billing/checkout', access: ACCESS.signedIn },
  { method: 'POST', leaf: '/portal', url: '/api/v1/billing/portal', access: ACCESS.signedIn },
];

const label = (route: RouteEntry) => `${route.method} ${route.url}`;
const withAccess = (level: Access) => ROUTES.filter((route) => route.access === level);

// ---------------------------------------------------------------------------
// Walking the real router
// ---------------------------------------------------------------------------

interface Layer {
  readonly route?: { readonly path: string | string[]; readonly methods: Record<string, boolean> };
  readonly handle?: { readonly stack?: Layer[] };
}

/** Every `METHOD path` registered in a router and the routers mounted in it. */
function registeredRoutes(router: Router): string[] {
  const found: string[] = [];
  const walk = (stack: Layer[]): void => {
    for (const layer of stack) {
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const path of paths) {
          for (const method of Object.keys(layer.route.methods)) found.push(`${method.toUpperCase()} ${path}`);
        }
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack);
      }
    }
  };
  walk((router as unknown as { stack: Layer[] }).stack);
  return found.sort();
}

describe('Route inventory', () => {
  it('lists every route the real router registers, and nothing else', () => {
    const router = createV1Router({
      prisma: {} as PrismaClient,
      requireAuth: (_req, _res, next) => next(),
      clerkWebhook: { signingSecret: undefined },
      billing: { stripe: undefined, planName: 'Pro', appUrl: 'https://app.example.com' },
    });

    expect(registeredRoutes(router)).toEqual(ROUTES.map((route) => `${route.method} ${route.leaf}`).sort());
  });

  it('declares exactly these public routes', () => {
    expect(withAccess(ACCESS.public).map(label)).toEqual([
      'GET /health',
      'GET /api/v1/health',
      'POST /api/webhooks/clerk',
      'POST /api/webhooks/stripe',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Calling every route at every access level
// ---------------------------------------------------------------------------

describe.skipIf(!DATABASE_URL_TEST)('Route access', () => {
  let prisma: PrismaClient;
  let user: SeedUser;
  let request: ReturnType<typeof supertest>;

  const send = (route: RouteEntry, as?: SeedUser): Promise<SuperResponse> => {
    const call = request[route.method.toLowerCase() as Lowercase<Method>](route.url);
    if (as) call.set(authHeader(as));
    return call.send({});
  };

  beforeAll(async () => {
    prisma = connectToTestDatabase();
    await truncateAll(prisma);
    user = await seedUser(prisma);
    request = supertest(buildTestApp({ prisma, knownUsers: [user] }));
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await prisma.$disconnect();
  });

  it.each(withAccess(ACCESS.public).map((route) => [label(route), route] as const))(
    'public: %s answers without a session',
    async (_label, route) => {
      const res = await send(route);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    },
  );

  it.each(withAccess(ACCESS.signedIn).map((route) => [label(route), route] as const))(
    'signed in: %s answers 401 without a session',
    async (_label, route) => {
      const res = await send(route);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
    },
  );

  it.each(withAccess(ACCESS.signedIn).map((route) => [label(route), route] as const))(
    'signed in: %s lets a signed-in user past the session check',
    async (_label, route) => {
      const res = await send(route, user);

      expect(res.status).not.toBe(401);
    },
  );

  it('answers an unknown route under /api/v1 with 401 before revealing that it does not exist', async () => {
    const res = await request.get('/api/v1/no-such-route');

    expect(res.status).toBe(401);
  });

  it('answers a signed-in user 404 in the response envelope for an unknown route', async () => {
    const res = await request.get('/api/v1/no-such-route').set(authHeader(user));

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });
});
