/**
 * Typed billing domain errors and the one place they become HTTP responses.
 *
 * Services and controllers throw these; `billingErrorHandler` (mounted on the
 * billing router) maps them to the canonical envelope. Anything else falls
 * through to the app-wide error handler.
 */
import type { NextFunction, Request, Response } from 'express';

import { ErrorCodes, sendError, type ErrorCode } from '@/api/envelope';

/** Base class: carries the HTTP status and the machine code. */
export abstract class BillingError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Stripe isn't configured on this deployment. */
export class BillingNotConfiguredError extends BillingError {
  readonly status = 503;
  readonly code = ErrorCodes.BILLING_NOT_CONFIGURED;

  constructor() {
    super('Billing is not set up');
  }
}

/** STRIPE_PRICE_ID names no active price in Stripe, so there is nothing to sell. */
export class PriceUnavailableError extends BillingError {
  readonly status = 503;
  readonly code = ErrorCodes.BILLING_NOT_CONFIGURED;

  constructor() {
    super('The plan cannot be purchased right now.');
  }
}

/** The signed-in user has no row (or it was deleted). */
export class UserNotFoundError extends BillingError {
  readonly status = 404;
  readonly code = ErrorCodes.NOT_FOUND;

  constructor() {
    super('Account not found');
  }
}

/** The user already has a subscription; changing or cancelling it is done in the customer portal. */
export class AlreadySubscribedError extends BillingError {
  readonly status = 409;
  readonly code = ErrorCodes.ALREADY_SUBSCRIBED;

  constructor() {
    super('You already have a subscription. Use Manage billing to change or cancel it.');
  }
}

/** The user has never started a Checkout, so Stripe holds nothing for them to manage. */
export class NoCustomerError extends BillingError {
  readonly status = 409;
  readonly code = ErrorCodes.NO_CUSTOMER;

  constructor() {
    super('There is no billing to manage yet. Subscribe first.');
  }
}

/**
 * Express error middleware: answers billing domain errors in the canonical
 * envelope, forwards everything else to the global handler.
 */
export function billingErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (!(err instanceof BillingError)) {
    next(err);
    return;
  }
  sendError(res, err.status, err.message, { code: err.code });
}
