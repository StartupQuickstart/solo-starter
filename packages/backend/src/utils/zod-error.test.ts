import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isZodError } from './zod-error';

describe('isZodError', () => {
  it('recognises an error thrown by this package’s zod', () => {
    const result = z.object({ startTime: z.string() }).safeParse({});

    expect(result.success).toBe(false);
    expect(isZodError(result.error)).toBe(true);
  });

  it('recognises a ZodError from another copy of zod by its shape', () => {
    const foreign = Object.assign(new Error('[]'), { name: 'ZodError', issues: [{ path: ['startTime'] }] });

    expect(isZodError(foreign)).toBe(true);
  });

  it('rejects other errors, including ones merely named ZodError', () => {
    expect(isZodError(new Error('boom'))).toBe(false);
    expect(isZodError(Object.assign(new Error('x'), { name: 'ZodError' }))).toBe(false);
    expect(isZodError({ name: 'ZodError', issues: [] })).toBe(false);
  });
});
