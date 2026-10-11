import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { AuthenticationError, getAuthenticatedUser } from './get-auth-context';

function requestWith(provisioned: Request['provisioned']): Request {
  return { provisioned } as Request;
}

describe('getAuthenticatedUser', () => {
  it('returns the ids of the provisioned user', () => {
    expect(getAuthenticatedUser(requestWith({ user: { id: 'usr_1', clerkId: 'user_clerk_1' } }))).toEqual({
      userId: 'usr_1',
      clerkUserId: 'user_clerk_1',
    });
  });

  it('reads a missing Clerk id as an empty string', () => {
    expect(getAuthenticatedUser(requestWith({ user: { id: 'usr_1' } })).clerkUserId).toBe('');
  });

  it('refuses a request with no user', () => {
    expect(() => getAuthenticatedUser(requestWith({}))).toThrow(AuthenticationError);
    expect(() => getAuthenticatedUser(requestWith(undefined))).toThrow(AuthenticationError);
  });

  it('refuses a user row without an id', () => {
    expect(() => getAuthenticatedUser(requestWith({ user: { clerkId: 'user_clerk_1' } }))).toThrow(AuthenticationError);
  });
});

describe('AuthenticationError', () => {
  it('carries the 401 status the error handler answers with', () => {
    const error = new AuthenticationError('no session');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AuthenticationError');
    expect(error.statusCode).toBe(401);
  });
});
