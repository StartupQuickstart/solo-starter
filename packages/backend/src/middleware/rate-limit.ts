import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Rate limiter configuration options
 */
export interface RateLimitOptions {
  /** Time window in milliseconds (default: 15 minutes) */
  windowMs?: number;
  /** Maximum requests per window per IP (default: 1000) */
  max?: number;
  /** Custom message for rate limit exceeded */
  message?: string | object;
  /** Whether to skip successful requests (default: false) */
  skipSuccessfulRequests?: boolean;
  /** Whether to skip failed requests (default: false) */
  skipFailedRequests?: boolean;
}

/** Machine-readable code of a 429 response, matching the API's error envelope. */
export const RATE_LIMITED_CODE = 'RATE_LIMITED';

/**
 * A 429 body in the same envelope every other error uses:
 * `{ success: false, code, message }`.
 */
function rateLimitedBody(message: string): { success: false; code: typeof RATE_LIMITED_CODE; message: string } {
  return { success: false, code: RATE_LIMITED_CODE, message };
}

/**
 * Create a rate limiting middleware
 *
 * Protects API endpoints from abuse by limiting requests per IP address.
 *
 * @param options - Rate limiter configuration
 * @returns Express middleware
 *
 * @example
 * // Basic usage with defaults (1000 req/15min)
 * app.use('/api', createRateLimiter());
 *
 * @example
 * // Stricter limits for auth endpoints
 * app.use('/api/auth', createRateLimiter({ max: 20, windowMs: 60000 }));
 */
export function createRateLimiter(options: RateLimitOptions = {}): RateLimitRequestHandler {
  const config: Partial<Options> = {
    // Time window: 15 minutes by default
    windowMs: options.windowMs || 15 * 60 * 1000,

    // Request limit: 1000 per window by default (permissive for mobile apps)
    max: options.max || 1000,

    // Response when rate limited, in the API's response envelope.
    message: options.message || rateLimitedBody('Too many requests, please try again later.'),

    // Use standard headers (RateLimit-*)
    standardHeaders: true,

    // Disable legacy headers (X-RateLimit-*)
    legacyHeaders: false,

    // Skip options
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,

    // Handler for when rate limit is exceeded
    handler: (_req, res, _next, _options) => {
      res.status(429).json(config.message);
    },
  };

  return rateLimit(config);
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters: Record<'standard' | 'strict' | 'auth', () => RateLimitRequestHandler> = {
  /**
   * Standard API rate limiter
   * 1000 requests per 15 minutes
   */
  standard: () =>
    createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 1000,
    }),

  /**
   * Strict rate limiter for sensitive endpoints
   * 20 requests per minute
   */
  strict: () =>
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 20,
      message: rateLimitedBody('Too many requests to this endpoint, please wait before trying again.'),
    }),

  /**
   * Auth endpoint rate limiter
   * 10 requests per minute (prevents brute force)
   */
  auth: () =>
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 10,
      message: rateLimitedBody('Too many authentication attempts, please wait before trying again.'),
    }),
};
