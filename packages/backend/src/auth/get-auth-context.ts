import type { Request } from 'express';

/**
 * Thrown when no signed-in user can be resolved for a request.
 * The global error handler maps this to HTTP 401.
 */
export class AuthenticationError extends Error {
  readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    // Maintain correct prototype chain for `instanceof` checks
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/** The signed-in user. Everything in the application belongs to one. */
export interface AuthenticatedUserContext {
  /** Internal DB user ID (nanoid). Scope every query by it. */
  readonly userId: string;
  /** Clerk user ID, used only for Clerk-specific operations. */
  readonly clerkUserId: string;
}

/**
 * Extract the signed-in user from a request.
 *
 * Reads `req.provisioned`, which `autoProvisioningMiddleware` fills in. Call
 * it at the top of every handler mounted behind `requireAuth()`, and pass
 * `userId` into the query itself so a row that belongs to someone else is
 * simply not found.
 *
 * @param req - The incoming Express request (must have passed requireAuth middleware)
 * @returns The signed-in user's ids
 * @throws {AuthenticationError} If no user was provisioned for the request
 *
 * @example
 * const { userId } = getAuthenticatedUser(req);
 * const rows = await model.list(userId);
 */
export function getAuthenticatedUser(req: Request): AuthenticatedUserContext {
  const user = req.provisioned?.user;

  if (!user?.id) {
    throw new AuthenticationError(
      'Missing auth context: requireAuth middleware not applied or provisioning failed',
    );
  }

  return { userId: user.id, clerkUserId: user.clerkId ?? '' };
}
