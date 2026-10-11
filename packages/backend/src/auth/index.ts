import { clerkMiddleware } from '@clerk/express';
import type { Application, RequestHandler } from 'express';
import { autoProvisioningMiddleware } from './auto-provision';
import type { AuthProvider } from './auth-provider';
import { clerkAuthProvider } from './clerk-auth-provider';

/**
 * Paths that must answer without Clerk. The health check is what the host and
 * load balancers probe: Clerk's middleware fails every request when the secret
 * key is missing or rotated, which would fail deploys for reasons unrelated to
 * whether the app is up.
 */
export const AUTH_EXEMPT_PATHS: readonly string[] = ['/api/v1/health', '/health'];

/** Run `middleware` for every request except the auth-exempt paths. */
export function skipAuthExemptPaths(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => (AUTH_EXEMPT_PATHS.includes(req.path) ? next() : middleware(req, res, next));
}

export function auth(app: Application, userProvider: any): AuthProvider {
  app.use(skipAuthExemptPaths(clerkMiddleware()));
  app.use(skipAuthExemptPaths(autoProvisioningMiddleware(userProvider, clerkAuthProvider)));

  return clerkAuthProvider;
}

// The signed-in user of a request
export { getAuthenticatedUser, AuthenticationError } from './get-auth-context';
export type { AuthenticatedUserContext } from './get-auth-context';

// Auth providers and provisioning
export { autoProvisioningMiddleware } from './auto-provision';
export { clerkAuthProvider } from './clerk-auth-provider';
export type { AuthProvider, AuthProviderBase } from './auth-provider';
