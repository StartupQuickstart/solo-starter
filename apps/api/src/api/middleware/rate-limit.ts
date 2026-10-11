import { getAuthenticatedUser } from '@app/backend';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { ErrorCodes, sendError } from '@/api/envelope';

/** Shown to a caller who is over the limit. */
export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.';

const MILLISECONDS_PER_SECOND = 1000;

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. */
  readonly limit: number;
  /** Window duration in milliseconds. */
  readonly windowMs: number;
  /** Clock, injected in tests. */
  readonly now?: () => number;
}

/**
 * In-memory sliding-window counter, one per limited route.
 *
 * State lives in the process, so the limit is per instance: run more than
 * one API instance and each keeps its own count. Move the store to Redis
 * before scaling the API horizontally.
 */
class SlidingWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly options: Required<RateLimitOptions>) {}

  /** Records a request for `key` unless it is over the limit. @returns whether it is over. */
  isOverLimit(key: string): boolean {
    const now = this.options.now();
    const windowStart = now - this.options.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

    if (recent.length >= this.options.limit) {
      this.hits.set(key, recent);
      return true;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return false;
  }
}

/** Answers 429 in the standard response envelope, with a Retry-After hint. */
function sendRateLimited(res: Response, windowMs: number): void {
  res.setHeader('Retry-After', String(Math.ceil(windowMs / MILLISECONDS_PER_SECOND)));
  sendError(res, 429, RATE_LIMIT_MESSAGE, { code: ErrorCodes.RATE_LIMITED });
}

function createLimiter(options: RateLimitOptions, keyOf: (req: Request) => string): RequestHandler {
  const window = new SlidingWindow({ now: Date.now, ...options });
  return (req: Request, res: Response, next: NextFunction): void => {
    let key: string;
    try {
      key = keyOf(req);
    } catch (error) {
      next(error);
      return;
    }
    if (window.isOverLimit(key)) {
      sendRateLimited(res, options.windowMs);
      return;
    }
    next();
  };
}

/**
 * Rate-limit a route by the signed-in user. Mount it after authentication: a
 * request with no user is passed to the error handler (401), not counted.
 *
 * @example
 * router.post('/checkout', rateLimitByUser({ limit: 10, windowMs: 10 * 60 * 1000 }), handler);
 */
export function rateLimitByUser(options: RateLimitOptions): RequestHandler {
  return createLimiter(options, (req) => getAuthenticatedUser(req).userId);
}

/**
 * Rate-limit a route by client address, for routes that answer without a
 * session. `req.ip` is only the real client address when `TRUST_PROXY` matches
 * the number of proxies in front of the API (see `configureApp`).
 */
export function rateLimitByIp(options: RateLimitOptions): RequestHandler {
  return createLimiter(options, (req) => `ip:${req.ip ?? 'unknown'}`);
}
