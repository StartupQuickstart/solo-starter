import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { AuthProviderBase } from './auth-provider';

class FixedAuthProvider extends AuthProviderBase {
  constructor(private readonly userId: string | null) {
    super();
  }

  override getAuth() {
    return { userId: this.userId };
  }
}

function runRequireAuth(provider: AuthProviderBase) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  provider.requireAuth()({} as Request, res, next);
  return { res, next };
}

describe('AuthProviderBase', () => {
  it('leaves getAuth and getUser to the provider that extends it', () => {
    const base = new AuthProviderBase();

    expect(() => base.getAuth({} as Request)).toThrow('Method not implemented.');
    expect(() => base.getUser({} as Request)).toThrow('Method not implemented.');
  });

  describe('requireAuth', () => {
    it('lets a request with a signed-in user through', () => {
      const { res, next } = runRequireAuth(new FixedAuthProvider('user_1'));

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('answers 401 in the response envelope when nobody is signed in', () => {
      const { res, next } = runRequireAuth(new FixedAuthProvider(null));

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('treats an empty user id as nobody', () => {
      const { res, next } = runRequireAuth(new FixedAuthProvider(''));

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
