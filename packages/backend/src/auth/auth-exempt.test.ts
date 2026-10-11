import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { skipAuthExemptPaths } from './index';

function run(path: string) {
  const middleware = vi.fn();
  const next = vi.fn() as unknown as NextFunction;
  skipAuthExemptPaths(middleware)({ path } as Request, {} as Response, next);
  return { middleware, next };
}

describe('skipAuthExemptPaths', () => {
  it('lets the health check through without running auth', () => {
    const { middleware, next } = run('/api/v1/health');

    expect(middleware).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('runs auth for every other path', () => {
    const { middleware, next } = run('/api/v1/notes');

    expect(middleware).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });
});
