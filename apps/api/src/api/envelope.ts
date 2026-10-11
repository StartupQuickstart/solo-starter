/**
 * Canonical HTTP response envelope for the API.
 *
 * Every endpoint responds with exactly one of:
 *
 *   Success: { success: true,  data: T, pagination?: Pagination }
 *   Error:   { success: false, code: string, message: string, details?: unknown }
 *
 * Consumers rely on this shape:
 *   - apps/web (via @app/ui `createApiClient`)
 *     returns `json.data`.
 *
 * Controllers must not hand-roll `res.json(...)` bodies: use these helpers so
 * the envelope can never drift per endpoint.
 */

import type { Response } from 'express';

/** Pagination block attached to list responses. */
export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

/** Machine-readable error codes shared across the API. */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  /** Billing (Stripe) isn't configured on this deployment (HTTP 503). */
  BILLING_NOT_CONFIGURED: 'BILLING_NOT_CONFIGURED',
  /** The feature is for subscribers and the user is not subscribed (HTTP 403). */
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  /** The user already has a subscription; a second Checkout would bill twice (HTTP 409). */
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  /** The user has no Stripe customer yet, so there is nothing to manage (HTTP 409). */
  NO_CUSTOMER: 'NO_CUSTOMER',
  UNPROCESSABLE: 'UNPROCESSABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Map an HTTP status to the conventional default error code. */
const DEFAULT_CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: ErrorCodes.VALIDATION_ERROR,
  401: ErrorCodes.UNAUTHORIZED,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  409: ErrorCodes.CONFLICT,
  422: ErrorCodes.UNPROCESSABLE,
  429: ErrorCodes.RATE_LIMITED,
};

/**
 * Send a success response in the canonical envelope.
 *
 * @param res - Express response
 * @param data - Payload placed under `data`
 * @param opts - Optional status (default 200) and pagination block
 */
export function sendData<T>(
  res: Response,
  data: T,
  opts: { status?: number; pagination?: Pagination } = {},
): void {
  const { status = 200, pagination } = opts;
  res.status(status).json({
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
  });
}

/**
 * Send an error response in the canonical envelope.
 *
 * @param res - Express response
 * @param status - HTTP status code
 * @param message - Human-readable message (safe for end users)
 * @param opts - Optional machine code (defaults by status) and details
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  opts: { code?: ErrorCode; details?: unknown } = {},
): void {
  const { code = DEFAULT_CODE_BY_STATUS[status] ?? ErrorCodes.INTERNAL_SERVER_ERROR, details } =
    opts;
  res.status(status).json({
    success: false,
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  });
}

/**
 * Build a Pagination block from raw list-query numbers.
 */
export function buildPagination(page: number, pageSize: number, total: number): Pagination {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}
