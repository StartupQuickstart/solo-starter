import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

import { apiLogger, isZodError } from '../utils';

/** Machine-readable codes of the errors these handlers answer. */
export const ERROR_CODE = {
  notFound: 'NOT_FOUND',
  validation: 'VALIDATION_ERROR',
  unauthorized: 'UNAUTHORIZED',
  internal: 'INTERNAL_SERVER_ERROR',
} as const;

const AUTHENTICATION_ERROR_NAME = 'AuthenticationError';

/**
 * Answers a request no route matched, in the response envelope.
 * Mount it after every router.
 */
export function createNotFoundHandler(): RequestHandler {
  return (req: Request, res: Response) => {
    apiLogger.warn('Route not found', { method: req.method, path: req.path, ip: req.ip });
    res.status(404).json({ success: false, code: ERROR_CODE.notFound, message: 'Route not found' });
  };
}

/**
 * The one place a thrown error becomes an HTTP response:
 *
 * - a Zod error is a 400 with the issues as `details`
 * - an `AuthenticationError` is a 401
 * - anything else is logged with its stack and answered as a 500 with a
 *   generic message, so internals never reach the client
 *
 * Mount it last.
 */
export function createErrorHandler(): ErrorRequestHandler {
  return (err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (isZodError(err)) {
      apiLogger.warn('Validation error', { errors: err.issues, path: req.path, method: req.method });
      res.status(400).json({
        success: false,
        code: ERROR_CODE.validation,
        message: 'Validation failed',
        details: err.issues,
      });
      return;
    }

    if (err.name === AUTHENTICATION_ERROR_NAME) {
      res.status(401).json({ success: false, code: ERROR_CODE.unauthorized, message: 'Authentication required' });
      return;
    }

    apiLogger.error('Unhandled route error', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    res.status(500).json({ success: false, code: ERROR_CODE.internal, message: 'Internal server error' });
  };
}
