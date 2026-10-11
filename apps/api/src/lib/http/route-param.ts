import type { Request } from 'express';

/**
 * A single named path parameter.
 *
 * Express types a parameter as `string | string[]` because a wildcard segment
 * yields a list. Routes here use plain `:name` segments, so anything else
 * means the request did not match the shape the handler expects.
 *
 * @param req - The request.
 * @param name - The parameter name, as written in the route path.
 * @returns The value, or `undefined` when it is absent, empty or a list.
 */
export function routeParam(req: Request, name: string): string | undefined {
  const value: unknown = req.params[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
