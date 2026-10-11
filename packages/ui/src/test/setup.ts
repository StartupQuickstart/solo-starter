import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// The DOM matchers are registered on the `expect` this package imports, here,
// instead of through `@testing-library/jest-dom/vitest`. That entry extends
// the copy of Vitest that jest-dom itself resolves, and in a pnpm workspace it
// can be a different copy from the one running the tests, which leaves two
// `expect`s in one process.
expect.extend(matchers);

declare module 'vitest' {
  // `Matchers` is Vitest's extension point; the type parameters have to repeat
  // its own declaration to merge with it.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<unknown, R> {}
}

// Vitest globals are off in this package, so Testing Library cannot register
// its own cleanup.
afterEach(() => {
  cleanup();
});

// jsdom has no layout engine and so no ResizeObserver; Radix dialogs and menus
// construct one when they open. Nothing in the tests depends on sizes.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
