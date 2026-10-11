/**
 * Where Clerk's sign-in and sign-up components are mounted. The one place the
 * paths are written: `ClerkProvider`, the request hook and the pages read them
 * from here. Each page is an optional catch-all route, because Clerk's
 * components add their own steps under the path (`/sign-in/factor-one`).
 */
export const AUTH_ROUTES = { signIn: '/sign-in', signUp: '/sign-up' } as const;

/** The open source attributions, served from `public/` (scripts/generate-notices.mjs). Licence text: nothing private. */
export const OPEN_SOURCE_NOTICES_PATH = '/open-source-notices.txt';

/**
 * Every path a signed-out visitor may open. Anything not listed is treated as
 * protected: a new page is private until it is added here on purpose.
 */
export const PUBLIC_PATHS: readonly string[] = [AUTH_ROUTES.signIn, AUTH_ROUTES.signUp, OPEN_SOURCE_NOTICES_PATH];

/** Whether a path is a public one or sits under it (`/sign-in/factor-one`). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
