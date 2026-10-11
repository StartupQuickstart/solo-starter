import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { runWithRequestId } from '../utils/request-context';

/** The header a request id arrives in and is answered with. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * What an incoming id may look like: short, and made of characters that are
 * safe in a header and a log line. Anything else is replaced, so a caller
 * cannot write newlines or a megabyte of text into the logs.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Gives every request an id.
 *
 * An incoming `X-Request-Id` is kept when it is short and safe (so an id
 * issued by a proxy or the web client follows the request through);
 * otherwise one is generated. The id is set on the response header, and every
 * log line written while the request is handled carries it as `requestId`
 * (see `utils/logger.ts`).
 *
 * Mount it first, before the request logger, so that line carries the id too.
 *
 * @param generate - Makes an id; tests pass a fixed one
 */
export function createRequestIdMiddleware(generate: () => string = randomUUID): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.get(REQUEST_ID_HEADER);
    const requestId = incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : generate();
    res.setHeader(REQUEST_ID_HEADER, requestId);
    runWithRequestId(requestId, next);
  };
}
