/** The part of a Zod validation error the error handlers report. */
export interface ZodErrorLike {
  readonly name: 'ZodError';
  readonly issues: readonly unknown[];
}

/**
 * Recognise a Zod validation error from any copy of zod.
 *
 * `instanceof z.ZodError` only matches errors from this package's own zod.
 * Apps resolve their own (apps/api is on zod 3, this package on zod 4), so
 * their validation errors failed the check and went out as 500s instead of
 * 400s. Both majors name the error `ZodError` and carry `issues`.
 */
export function isZodError(err: unknown): err is ZodErrorLike {
  return (
    err instanceof Error &&
    err.name === 'ZodError' &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}
