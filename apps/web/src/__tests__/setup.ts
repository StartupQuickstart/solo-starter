import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import { beforeEach, expect, vi } from 'vitest';

// The DOM matchers are registered on the `expect` this app imports, here,
// instead of through `@testing-library/jest-dom/vitest`. That entry extends
// the copy of Vitest that jest-dom itself resolves, and in a pnpm workspace it
// can be a different copy from the one running the tests, which leaves two
// `expect`s in one process (assertions such as `rejects.toThrow` then misread
// the errors they are given).
expect.extend(matchers);

declare module 'vitest' {
  // `Matchers` is Vitest's extension point; the type parameters have to repeat
  // its own declaration to merge with it.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<unknown, R> {}
}

// jsdom has no layout engine and so no ResizeObserver; Radix popovers and
// menus construct one when they open. Nothing in the tests depends on sizes.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

// jsdom does no layout, so it has no scrolling either. An open menu keeps its
// current item in view by calling this; in tests there is nothing to scroll.
Element.prototype.scrollIntoView ??= () => undefined;

// The API client builds request URLs from NEXT_PUBLIC_API_URL. Node's fetch
// rejects relative URLs, so tests need an absolute base; MSW handlers match
// any host via `*/api/v1/...` patterns.
process.env['NEXT_PUBLIC_API_URL'] = 'http://api.test';

// Screens read and write the URL through the App Router's hooks, which need
// a router around them. Tests get an in-memory one (helpers/navigation.ts);
// everything else in next/navigation (notFound, redirect) stays real. A file
// that mocks next/navigation itself takes precedence over this.
vi.mock('next/navigation', async (importOriginal) => {
  const [original, { navigationHooks }] = await Promise.all([
    importOriginal<typeof import('next/navigation')>(),
    import('./helpers/navigation'),
  ]);
  return { ...original, ...navigationHooks };
});

beforeEach(async () => {
  (await import('./helpers/navigation')).resetTestNavigation();
});
