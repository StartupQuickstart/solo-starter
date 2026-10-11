import { clerkMiddleware } from '@clerk/nextjs/server';

import { AUTH_ROUTES, isPublicPath } from '@/lib/auth-routes';

/**
 * The request hook (Next.js 16 calls this file `proxy`): Clerk's
 * `clerkMiddleware()`, which attaches the session to the request so `auth()`
 * works downstream.
 *
 * It also turns a signed-out visitor away early from every path that is not
 * listed as public (`src/lib/auth-routes.ts`): protected by default. Clerk's
 * documentation is explicit that this redirect is a convenience and not the
 * guarantee. The guarantee is that each protected page calls
 * `auth.protect()` itself (the pages under `src/app/(app)`), and that the API
 * checks the session on every request. `src/__tests__/route-protection.test.ts`
 * fails when a page is added that does neither.
 *
 * The sign-in and sign-up paths are passed as options so the redirect goes to
 * this app's own pages even where the `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
 * variable is not set.
 */
export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicPath(request.nextUrl.pathname)) return;
    const { isAuthenticated, redirectToSignIn } = await auth();
    if (!isAuthenticated) return redirectToSignIn();
  },
  { signInUrl: AUTH_ROUTES.signIn, signUpUrl: AUTH_ROUTES.signUp },
);

export const config = {
  matcher: [
    // Clerk's documented matcher, with one addition: the healthcheck is left
    // out. /api/health must never pass through Clerk: the hook throws on every
    // matched request when the secret key is missing or rotated (or Clerk is
    // down), which would fail deploy healthchecks for reasons unrelated to the app.
    '/((?!_next|api/health|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes other than the healthcheck.
    '/(api(?!/health)|trpc)(.*)',
    // Always run for Clerk's own frontend API routes.
    '/__clerk/(.*)',
  ],
};
