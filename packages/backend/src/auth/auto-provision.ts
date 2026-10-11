import { UserContext } from '@/utils';
import { NextFunction, Request, Response } from 'express';
import { AuthProvider } from './auth-provider';

declare global {
  namespace Express {
    interface Request {
      provisioned?: {
        user?: any;
      };
    }
  }
}

interface UserProvider {
  findOneWithContext: (options: any, context: UserContext) => Promise<any | null>;
  createWithContext: (data: any, context: UserContext) => Promise<any>;
  updateWithContext: (id: string, data: any, context: UserContext) => Promise<any>;
}

/** Prisma's error code for a unique-constraint violation. */
const UNIQUE_VIOLATION_CODE = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === UNIQUE_VIOLATION_CODE
  );
}

/**
 * Create a row, or return the one a concurrent request created first.
 *
 * A new user's first page load fires several API calls at once. Each one finds
 * no user and tries to create it; all but one then hit the unique constraint.
 * The losers re-read and use the winner's row instead of failing the request.
 */
async function createOrFindExisting<T>(
  create: () => Promise<T>,
  findExisting: () => Promise<T | null | undefined>,
): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await findExisting();
    if (!existing) throw error;
    return existing;
  }
}

/**
 * Creates middleware that provisions the signed-in user: the first request
 * with a valid session creates their row, and every request gets it on
 * `req.provisioned.user`.
 *
 * @param userProvider - Finds, creates and updates user rows
 * @param authProvider - Reads the signed-in user from the request
 * @returns Express middleware function
 */
export function autoProvisioningMiddleware(userProvider: UserProvider, authProvider: AuthProvider) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.provisioned = {};

      // Gets the authenticated user from the auth provider
      const clerkUser = await authProvider.getUser(req);

      if (!clerkUser) {
        return next(); // User not found in auth provider, continue
      }

      const userContext: UserContext = { userClerkId: clerkUser.id };

      // Check if user exists in database by clerkId
      let user = await userProvider.findOneWithContext({ clerkId: clerkUser.id }, userContext);

      if (!user) {
        // A person is their Clerk id and nothing else. A row is never matched
        // by email: an address is not proof of identity (it may be unverified,
        // reused, or absent, and a lookup by an absent email would match any
        // row), so a matching email must not hand one account's rows to another.
        user = await createOrFindExisting(
          () =>
            userProvider.createWithContext(
              {
                clerkId: clerkUser.id,
                email: clerkUser.email,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
                createdAt: clerkUser.createdAt,
                updatedAt: clerkUser.updatedAt,
              },
              userContext,
            ),
          () => userProvider.findOneWithContext({ clerkId: clerkUser.id }, userContext),
        );
      }

      req.provisioned.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
