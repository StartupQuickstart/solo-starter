import { Request } from 'express';

interface AuthContext {
  userId: string | null;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthProvider {
  getAuth: (req: Request) => AuthContext;
  getUser: (req: Request) => Promise<AuthenticatedUser | null>;

  // middleware
  requireAuth: () => (req: Request, res: any, next: any) => void;
}

class AuthProviderBase implements AuthProvider {
  getAuth(_req: Request): AuthContext {
    throw new Error('Method not implemented.');
  }
  getUser(_req: Request): Promise<AuthenticatedUser | null> {
    throw new Error('Method not implemented.');
  }

  /**
   * Middleware that requires authentication
   * @returns Express middleware that requires authentication
   */
  requireAuth() {
    return (req: Request, res: any, next: any) => {
      const { userId } = this.getAuth(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' });
      }
      next();
    };
  }
}

export { AuthContext, AuthenticatedUser, AuthProvider, AuthProviderBase };
