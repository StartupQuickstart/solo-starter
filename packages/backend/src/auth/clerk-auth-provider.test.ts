import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Clerk SDK is the one thing replaced here: it is the network boundary.
const mockGetAuth = vi.fn();
const mockClerkClient = { users: { getUser: vi.fn() } };

vi.mock('@clerk/express', () => ({
  getAuth: mockGetAuth,
  clerkClient: mockClerkClient,
}));

const CLERK_USER = {
  id: 'user_abc123',
  emailAddresses: [{ emailAddress: 'ada@example.com' }],
  firstName: 'Ada',
  lastName: 'Example',
  imageUrl: 'https://example.com/avatar.jpg',
  createdAt: 1704067200000,
  updatedAt: 1704153600000,
};

describe('ClerkAuthProvider', () => {
  const req = {} as Request;
  let provider: (typeof import('./clerk-auth-provider'))['clerkAuthProvider'];

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('./clerk-auth-provider');
    provider = module.clerkAuthProvider;
    provider.clearCache();
    mockGetAuth.mockReturnValue({ userId: 'user_abc123' });
  });

  describe('getAuth', () => {
    it('reads the user id from the session', () => {
      expect(provider.getAuth(req)).toEqual({ userId: 'user_abc123' });
      // No acceptsToken option: only session tokens authenticate.
      expect(mockGetAuth).toHaveBeenCalledWith(req);
    });

    it('reports nobody for a request without a session', () => {
      mockGetAuth.mockReturnValue({ userId: null });

      expect(provider.getAuth(req)).toEqual({ userId: null });
    });
  });

  describe('getUser', () => {
    it('is null, and asks Clerk nothing, when nobody is signed in', async () => {
      mockGetAuth.mockReturnValue({ userId: null });

      expect(await provider.getUser(req)).toBeNull();
      expect(mockClerkClient.users.getUser).not.toHaveBeenCalled();
    });

    it('fetches the user from Clerk and reduces it to what provisioning needs', async () => {
      mockClerkClient.users.getUser.mockResolvedValue(CLERK_USER);

      expect(await provider.getUser(req)).toEqual({
        id: 'user_abc123',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Example',
        imageUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date(1704067200000),
        updatedAt: new Date(1704153600000),
      });
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith('user_abc123');
    });

    it('uses an empty email when the user has no address', async () => {
      mockClerkClient.users.getUser.mockResolvedValue({ ...CLERK_USER, emailAddresses: [] });

      expect((await provider.getUser(req))?.email).toBe('');
    });

    it('answers a second request for the same user from the cache', async () => {
      mockClerkClient.users.getUser.mockResolvedValue(CLERK_USER);

      await provider.getUser(req);
      await provider.getUser(req);

      expect(mockClerkClient.users.getUser).toHaveBeenCalledTimes(1);
    });

    it('asks Clerk again once the user is cleared from the cache', async () => {
      mockClerkClient.users.getUser.mockResolvedValue(CLERK_USER);
      await provider.getUser(req);

      provider.clearUserCache('user_abc123');
      await provider.getUser(req);

      expect(mockClerkClient.users.getUser).toHaveBeenCalledTimes(2);
    });

    it('passes a Clerk failure on, and caches nothing', async () => {
      mockClerkClient.users.getUser.mockRejectedValueOnce(new Error('Clerk is down'));
      await expect(provider.getUser(req)).rejects.toThrow('Clerk is down');

      mockClerkClient.users.getUser.mockResolvedValue(CLERK_USER);

      expect((await provider.getUser(req))?.id).toBe('user_abc123');
    });
  });
});
