import { useMemo, useSyncExternalStore } from 'react';
import { vi } from 'vitest';

/**
 * A stand-in for the App Router in component tests: a URL held in memory that
 * the three navigation hooks read and the router writes. Screens that keep
 * their state in the URL (a tab, a filter, a range) behave as they do in the
 * browser, and a test can read where the screen has taken it.
 *
 * It is installed for every test file by `setup.ts`. A file that needs a
 * different router still mocks `next/navigation` itself.
 */

const ORIGIN = 'http://app.test';
const listeners = new Set<() => void>();
let current = new URL('/', ORIGIN);

function go(href: string): void {
  current = new URL(href, current);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The router the hooks hand out. Stable, so effects that depend on it do not re-run. */
export const testRouter = {
  push: vi.fn(go),
  replace: vi.fn(go),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

/** Where the screen under test is now: its path, and its query string as `URLSearchParams`. */
export const testLocation = {
  get pathname(): string {
    return current.pathname;
  },
  get searchParams(): URLSearchParams {
    return new URLSearchParams(current.search);
  },
  /** Starts a test at an address, as if the page had been opened there. */
  set(href: string): void {
    go(href);
  },
};

/** Back to `/` with a clean router. Called before every test by `setup.ts`. */
export function resetTestNavigation(): void {
  current = new URL('/', ORIGIN);
  for (const mock of Object.values(testRouter)) mock.mockClear();
  listeners.forEach((listener) => listener());
}

/** The three hooks, reading the in-memory URL. */
export const navigationHooks = {
  useRouter: () => testRouter,
  usePathname: (): string => useSyncExternalStore(subscribe, () => current.pathname),
  useSearchParams: (): URLSearchParams => {
    const search = useSyncExternalStore(subscribe, () => current.search);
    return useMemo(() => new URLSearchParams(search), [search]);
  },
};
