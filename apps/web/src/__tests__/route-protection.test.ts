import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isPublicPath } from '@/lib/auth-routes';

/**
 * Every route in the app, and whether a signed-out visitor may see it.
 *
 * Pages are discovered from the file system, so a page that is added without
 * being listed here fails the suite: a new route is never public by accident.
 *
 * A route is guarded twice, and both are checked here:
 *  - the request hook turns signed-out visitors away from every path that is
 *    not on its public list (`src/lib/auth-routes.ts`). The hook's own
 *    behaviour is covered by `proxy.test.ts`; this file checks that the list
 *    and the pages agree.
 *  - a protected page calls `auth.protect()` before it renders anything, which
 *    is the guarantee Clerk's documentation asks for. A public page must not
 *    call it (signed-out people have to reach it).
 */

const protect = vi.fn(async () => ({ userId: 'user_test' }));

vi.mock('@clerk/nextjs/server', () => ({ auth: Object.assign(vi.fn(), { protect }) }));

// Clerk's components are placed by the pages, not rendered: these tests call the page functions.
vi.mock('@clerk/nextjs', () => ({
  SignIn: () => null,
  SignUp: () => null,
  UserProfile: () => null,
  useAuth: () => ({ getToken: async () => null }),
}));

/** Routes a signed-out visitor may open. */
const PUBLIC_ROUTES = ['/sign-in/[[...sign-in]]', '/sign-up/[[...sign-up]]'] as const;

/** Routes that send a signed-out visitor to sign in. */
const PROTECTED_ROUTES = [
  // EXAMPLE: notes. Home shows the example feature.
  '/',
  '/account/[[...rest]]',
  '/billing',
  // KIT CARD: remove this line with the page (src/app/(app)/upgrade).
  '/upgrade',
] as const;

/** Route handlers, all of which answer without a session. */
const PUBLIC_ROUTE_HANDLERS = ['/api/health'] as const;

interface PageProps {
  readonly params: Promise<Record<string, string>>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type PageModule = { default: (props: PageProps) => unknown };

const pageModules = import.meta.glob<PageModule>('../app/**/page.tsx');
const handlerFiles = Object.keys(import.meta.glob('../app/**/route.ts'));

/** `../app/(app)/billing/page.tsx` -> `/billing`. Route groups do not appear in the URL. */
function routeOf(file: string, leaf: string): string {
  const segments = file
    .replace('../app', '')
    .replace(new RegExp(`/${leaf}$`), '')
    .split('/')
    .filter((segment) => segment !== '' && !(segment.startsWith('(') && segment.endsWith(')')));
  return `/${segments.join('/')}`;
}

/** `/account/[[...rest]]` -> `/account`: the address a visitor types for an optional catch-all route. */
function addressOf(route: string): string {
  return route.replace(/\/\[\[\.\.\.[^/]+\]\]$/, '') || '/';
}

const pagesByRoute = new Map(Object.entries(pageModules).map(([file, load]) => [routeOf(file, 'page.tsx'), load]));

async function renderPage(route: string): Promise<void> {
  const load = pagesByRoute.get(route);
  if (!load) throw new Error(`No page file for ${route}`);
  const page = await load();
  await page.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  protect.mockClear();
});

describe('route protection', () => {
  it('classifies every page in the app as public or protected', () => {
    expect([...pagesByRoute.keys()].sort()).toEqual([...PUBLIC_ROUTES, ...PROTECTED_ROUTES].sort());
  });

  it.each(PROTECTED_ROUTES)('requires a session for %s', async (route) => {
    await renderPage(route);

    expect(protect).toHaveBeenCalledTimes(1);
  });

  it.each(PROTECTED_ROUTES)('renders nothing for %s when the session check refuses', async (route) => {
    protect.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(renderPage(route)).rejects.toThrow('NEXT_REDIRECT');
  });

  it.each(PROTECTED_ROUTES)('has the request hook turn signed-out visitors away from %s', (route) => {
    expect(isPublicPath(addressOf(route))).toBe(false);
    expect(isPublicPath(`${addressOf(route).replace(/\/$/, '')}/anything-under-it`)).toBe(false);
  });

  it.each(PUBLIC_ROUTES)('leaves %s open to signed-out visitors', async (route) => {
    await renderPage(route);

    expect(protect).not.toHaveBeenCalled();
    expect(isPublicPath(addressOf(route))).toBe(true);
  });

  it('classifies every route handler', () => {
    expect(handlerFiles.map((file) => routeOf(file, 'route.ts')).sort()).toEqual([...PUBLIC_ROUTE_HANDLERS].sort());
  });
});
