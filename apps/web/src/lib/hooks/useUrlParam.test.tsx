import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUrlParams } from './useUrlParam';

/**
 * A router as the real one behaves: `replace` starts a navigation, and the
 * new address only shows up in `useSearchParams` once it lands.
 */
const router = vi.hoisted(() => ({ landed: '', replaced: [] as string[] }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/notes',
  useRouter: () => ({ replace: (url: string) => void router.replaced.push(url) }),
  useSearchParams: () => new URLSearchParams(router.landed),
}));

describe('useUrlParams', () => {
  beforeEach(() => {
    router.landed = '';
    router.replaced.length = 0;
  });

  it('writes a parameter, and removes one that is set to nothing', () => {
    router.landed = 'q=launch&page=2';
    const { result } = renderHook(() => useUrlParams());

    act(() => result.current[1]({ status: 'active', page: null }));

    expect(router.replaced).toEqual(['/notes?q=launch&status=active']);
  });

  it('builds a second write on the first when the first has not landed yet', () => {
    const { result } = renderHook(() => useUrlParams());

    // A filter is picked, and a search term settles before that navigation has landed.
    act(() => result.current[1]({ status: 'on_hold' }));
    act(() => result.current[1]({ q: 'billing' }));

    expect(router.replaced.at(-1)).toBe('/notes?status=on_hold&q=billing');
  });

  it('follows the address when it changes from outside', () => {
    const { result, rerender } = renderHook(() => useUrlParams());
    act(() => result.current[1]({ status: 'on_hold' }));

    // The person pressed Back: the address is what the browser says, not what was last asked for.
    router.landed = 'range=90';
    rerender();
    act(() => result.current[1]({ q: 'billing' }));

    expect(router.replaced.at(-1)).toBe('/notes?range=90&q=billing');
  });

  it('leaves a bare path when the last parameter goes', () => {
    router.landed = 'status=active';
    const { result } = renderHook(() => useUrlParams());

    act(() => result.current[1]({ status: null }));

    expect(router.replaced).toEqual(['/notes']);
  });
});
