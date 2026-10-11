/**
 * Stand-in for Clerk and user provisioning in integration tests.
 *
 * @module tests/integration/helpers/stub-auth
 */

import crypto from 'crypto';
import type { RequestHandler } from 'express';
import type { SeedUser } from './seed';

/** The secret used to sign test tokens. Never used outside NODE_ENV=test. */
const TEST_JWT_SECRET = process.env['TEST_JWT_SECRET'] ?? 'test-secret-do-not-use-in-production';

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Mint a test token: `<header>.<payload>.<HMAC-SHA256 signature>`, shaped
 * like a session token. It is ONLY accepted by `stubAuthMiddleware`.
 *
 * @param userId - Internal DB user ID
 * @param clerkUserId - Clerk user ID
 * @returns A signed token string
 */
export function mintTestToken(userId: string, clerkUserId: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ sub: clerkUserId, userId, iat: Math.floor(Date.now() / 1000) }));

  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', TEST_JWT_SECRET).update(signingInput).digest('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Express middleware that substitutes for the real Clerk + provisioning stack
 * during tests. A request carrying the token of a known user gets that user
 * on `req.provisioned`, exactly as provisioning would leave it; any other
 * request gets nothing and is refused by the session check.
 *
 * **Security guard:** throws immediately if `NODE_ENV !== 'test'`.
 *
 * @param knownUsers - The seeded users whose tokens should be accepted
 * @returns An Express RequestHandler
 */
export function stubAuthMiddleware(...knownUsers: SeedUser[]): RequestHandler {
  return (req, _res, next) => {
    if (process.env['NODE_ENV'] !== 'test') {
      throw new Error('stubAuthMiddleware: must not be used outside NODE_ENV=test');
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice('Bearer '.length);
    const user = knownUsers.find((known) => known.token === token);

    if (user) {
      req.provisioned = { user: { id: user.id, clerkId: user.clerkId, email: user.email } };
    }

    next();
  };
}
