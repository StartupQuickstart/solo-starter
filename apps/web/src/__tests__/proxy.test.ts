import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it, vi } from 'vitest';

/** What the request hook's handler is given: Clerk's `auth` and the request. */
interface SessionCheck {
  readonly isAuthenticated: boolean;
  readonly redirectToSignIn: () => unknown;
}
type Handler = (auth: () => Promise<SessionCheck>, request: { readonly nextUrl: { readonly pathname: string } }) => Promise<unknown>;

const clerkMiddleware = vi.hoisted(() => vi.fn<(handler: Handler, options: unknown) => string>(() => 'clerk-request-hook'));

// Only `clerkMiddleware` exists on this stand-in: importing the deprecated
// `createRouteMatcher` from it would be `undefined` and fail on first call.
vi.mock('@clerk/nextjs/server', () => ({ clerkMiddleware }));

import proxy, { config } from '@/proxy';
import { AUTH_ROUTES } from '@/lib/auth-routes';

// The module calls clerkMiddleware once, when it is loaded. Vitest clears mock
// call records before each test, so they are kept here.
const callsAtLoad = [...clerkMiddleware.mock.calls];

function handlerAtLoad(): Handler {
  const handler = callsAtLoad[0]?.[0];
  if (!handler) throw new Error('clerkMiddleware was not given a handler');
  return handler;
}

const ORIGIN = 'https://app.example.test';
const REDIRECT = 'redirect-to-sign-in';

function runsOn(path: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` });
}

/** Runs the hook's own handler for a path, as a signed-in or a signed-out visitor. */
async function visit(pathname: string, isAuthenticated: boolean) {
  const redirectToSignIn = vi.fn(() => REDIRECT);
  const auth = vi.fn(async () => ({ isAuthenticated, redirectToSignIn }));
  const result = await handlerAtLoad()(auth, { nextUrl: { pathname } });
  return { result, auth, redirectToSignIn };
}

describe('proxy', () => {
  it('is clerkMiddleware, called once', () => {
    expect(callsAtLoad).toHaveLength(1);
    expect(proxy).toBe('clerk-request-hook');
  });

  it("sends signed-out visitors to this app's own pages, not Clerk's hosted ones", () => {
    expect(callsAtLoad[0]?.[1]).toEqual({ signInUrl: '/sign-in', signUpUrl: '/sign-up' });
    expect(callsAtLoad[0]?.[1]).toEqual({ signInUrl: AUTH_ROUTES.signIn, signUpUrl: AUTH_ROUTES.signUp });
  });

  it.each(['/', '/billing', '/account', '/account/security', '/a-page-added-later', '/sign-in-help', '/api/anything'])(
    'turns a signed-out visitor away from %s',
    async (path) => {
      const { result, redirectToSignIn } = await visit(path, false);

      expect(redirectToSignIn).toHaveBeenCalledTimes(1);
      expect(result).toBe(REDIRECT);
    },
  );

  it.each(['/', '/billing', '/account/security'])('lets a signed-in person through to %s', async (path) => {
    const { result, redirectToSignIn } = await visit(path, true);

    expect(redirectToSignIn).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it.each(['/sign-in', '/sign-in/factor-one', '/sign-up', '/sign-up/verify-email-address', '/open-source-notices.txt'])(
    'leaves %s open without asking who is there',
    async (path) => {
      const { result, auth } = await visit(path, false);

      expect(auth).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    },
  );

  it.each(['/', '/billing', '/account', '/account/security', '/sign-in', '/sign-in/factor-one', '/sign-up', '/api/anything', '/__clerk/v1/client'])(
    'runs on %s',
    (path) => {
      expect(runsOn(path)).toBe(true);
    },
  );

  it.each(['/api/health', '/_next/static/chunks/main.js', '/brand/logo.svg', '/icon.svg'])(
    'does not run on %s',
    (path) => {
      expect(runsOn(path)).toBe(false);
    },
  );
});
