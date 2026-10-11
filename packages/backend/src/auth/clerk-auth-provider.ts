import { clerkClient, getAuth } from '@clerk/express';
import type { Request } from 'express';
import { AuthProviderBase, AuthenticatedUser } from './auth-provider';

// =============================================================================
// TTL Cache Implementation
// =============================================================================

/**
 * Simple in-memory TTL cache to reduce external API calls
 * Used to cache Clerk user data
 */
class TTLCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private ttlMs: number) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // For testing purposes
  size(): number {
    return this.cache.size;
  }
}

// =============================================================================
// Cache Configuration
// =============================================================================

/** Cache TTL: 5 minutes (configurable via env) */
const CACHE_TTL_MS = parseInt(process.env.CLERK_CACHE_TTL_MS || '300000', 10);

/** User data cache (keyed by userId) */
const userCache = new TTLCache<AuthenticatedUser>(CACHE_TTL_MS);

// =============================================================================
// ClerkAuthProvider
// =============================================================================

class ClerkAuthProvider extends AuthProviderBase {
  client: typeof clerkClient = clerkClient;

  /**
   * Retrieves authentication context from the request
   * @param req - Express request
   * @returns AuthContext object
   */
  getAuth(req: Request) {
    // Session tokens only (Clerk's default). API keys, OAuth and machine
    // tokens are not accepted: nothing in the API is built for them, and each
    // would need its own authorization rules before being let in.
    const { userId } = getAuth(req);
    return { userId };
  }

  /**
   * Retrieves authenticated user details
   * Uses in-memory cache to reduce Clerk API calls
   * @param req - Express request
   * @returns AuthenticatedUser object or null if not authenticated
   */
  async getUser(req: Request): Promise<AuthenticatedUser | null> {
    const { userId } = this.getAuth(req);

    if (!userId) {
      return null;
    }

    // Check cache first
    const cached = userCache.get(userId);
    if (cached) {
      return cached;
    }

    // Fetch from Clerk API
    const clerkUser = await this.client.users.getUser(userId);

    const user: AuthenticatedUser = {
      id: clerkUser.id,
      email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      createdAt: new Date(clerkUser.createdAt),
      updatedAt: new Date(clerkUser.updatedAt),
    };

    // Cache the result
    userCache.set(userId, user);

    return user;
  }

  /**
   * Clear all cached data
   * Useful for testing or forced refresh
   */
  clearCache(): void {
    userCache.clear();
  }

  /**
   * Clear cached data for a specific user
   * @param userId - The user ID to clear from cache
   */
  clearUserCache(userId: string): void {
    userCache.delete(userId);
  }
}

export const clerkAuthProvider = new ClerkAuthProvider();

// Export cache utilities for testing
export { userCache, TTLCache };
