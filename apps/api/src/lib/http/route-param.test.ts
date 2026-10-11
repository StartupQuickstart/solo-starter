import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { routeParam } from './route-param';

function requestWith(params: Record<string, unknown>): Request {
  return { params } as unknown as Request;
}

describe('routeParam', () => {
  it('returns a plain segment', () => {
    expect(routeParam(requestWith({ id: 'usr_1' }), 'id')).toBe('usr_1');
  });

  it('returns undefined for a missing or empty segment', () => {
    expect(routeParam(requestWith({}), 'id')).toBeUndefined();
    expect(routeParam(requestWith({ id: '' }), 'id')).toBeUndefined();
  });

  it('returns undefined for a wildcard segment, which Express delivers as a list', () => {
    expect(routeParam(requestWith({ id: ['a', 'b'] }), 'id')).toBeUndefined();
  });
});
