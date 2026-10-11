import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

import { NavigationProvider, resolveActiveItems, type NavigationConfig } from './NavigationProvider';
import { useNavigation } from './useNavigation';

const NAVIGATION: NavigationConfig = {
  groups: [
    {
      id: 'main',
      items: [
        { id: 'dashboard', title: 'Dashboard', url: '/' },
        { id: 'notes', title: 'Notes', url: '/notes' },
        {
          id: 'settings',
          title: 'Settings',
          children: [{ id: 'billing', title: 'Billing', url: '/billing' }],
        },
      ],
    },
  ],
};

/** Ids of the items marked active, children included. */
function activeIds(config: NavigationConfig): string[] {
  return config.groups
    .flatMap((group) => group.items)
    .flatMap((item) => [item, ...(item.children ?? [])])
    .filter((item) => item.isActive)
    .map((item) => item.id);
}

function wrapper({ children }: { children: ReactNode }) {
  return <NavigationProvider initialNavigation={NAVIGATION}>{children}</NavigationProvider>;
}

beforeEach(() => {
  pathname.current = '/';
});

describe('resolveActiveItems', () => {
  it('marks the item whose URL is the current page', () => {
    expect(activeIds(resolveActiveItems(NAVIGATION, '/notes'))).toEqual(['notes']);
  });

  it('marks a nested item', () => {
    expect(activeIds(resolveActiveItems(NAVIGATION, '/billing'))).toEqual(['billing']);
  });

  it('marks nothing on a page the navigation does not list', () => {
    expect(activeIds(resolveActiveItems(NAVIGATION, '/profile'))).toEqual([]);
  });

  it("lets an item's own isActive win over the URL comparison", () => {
    const config: NavigationConfig = {
      groups: [
        {
          id: 'main',
          items: [
            { id: 'notes', title: 'Notes', url: '/notes', isActive: true },
            { id: 'dashboard', title: 'Dashboard', url: '/', isActive: false },
          ],
        },
      ],
    };

    expect(activeIds(resolveActiveItems(config, '/'))).toEqual(['notes']);
  });

  it('does not change the tree it was given', () => {
    const before = structuredClone(NAVIGATION);

    resolveActiveItems(NAVIGATION, '/notes');

    expect(NAVIGATION).toEqual(before);
  });
});

describe('NavigationProvider', () => {
  it('moves the active item when the page changes', () => {
    const { result, rerender } = renderHook(() => useNavigation(), { wrapper });
    expect(activeIds(result.current.navigation)).toEqual(['dashboard']);

    pathname.current = '/notes';
    rerender();

    expect(activeIds(result.current.navigation)).toEqual(['notes']);
  });

  it('shows the breadcrumbs a page sets', () => {
    const { result } = renderHook(() => useNavigation(), { wrapper });

    act(() => result.current.setBreadcrumbs([{ id: 'notes', label: 'Notes' }]));

    expect(result.current.breadcrumbs).toEqual([{ id: 'notes', label: 'Notes' }]);
  });

  it("drops a page's breadcrumbs on navigation, without the page clearing them", () => {
    pathname.current = '/notes';
    const { result, rerender } = renderHook(() => useNavigation(), { wrapper });
    act(() => result.current.setBreadcrumbs([{ id: 'notes', label: 'Notes' }]));

    pathname.current = '/billing';
    rerender();

    expect(result.current.breadcrumbs).toEqual([]);
  });

  it('clears the breadcrumbs on request', () => {
    const { result } = renderHook(() => useNavigation(), { wrapper });
    act(() => result.current.setBreadcrumbs([{ id: 'notes', label: 'Notes' }]));

    act(() => result.current.clearBreadcrumbs());

    expect(result.current.breadcrumbs).toEqual([]);
  });

  it('refuses to be read outside the provider, naming the fix', () => {
    function Reader() {
      useNavigation();
      return null;
    }
    // React logs the render error it is about to rethrow.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Reader />)).toThrow('useNavigation must be used within a NavigationProvider');

    consoleError.mockRestore();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
