'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { NavigationContext, type BreadcrumbData } from './useNavigation';

export interface NavigationAction {
  id: string;
  title: string;
  icon?: ReactNode;
  onClick?: () => void;
  url?: string;
}

export interface NavigationItem {
  id: string;
  title: string;
  url?: string;
  icon?: ReactNode;
  badge?: string | number;
  /**
   * Whether this item is the page being viewed. Set it when the app has its
   * own rule (for example "current for every page under this URL"). Left
   * unset, an item is active when its URL equals the current pathname.
   */
  isActive?: boolean;
  children?: NavigationItem[];
  actions?: NavigationAction[];
}

export interface NavigationGroup {
  id: string;
  title?: string;
  items: NavigationItem[];
}

export interface NavigationConfig {
  groups: NavigationGroup[];
}

interface NavigationProviderProps {
  children: ReactNode;
  /** The navigation tree. Pass a new object to change it. */
  initialNavigation: NavigationConfig;
}

/**
 * Mark the active item in a navigation tree. An item's own `isActive` wins;
 * otherwise the item whose URL equals `pathname` is active.
 *
 * @param config - The navigation tree as the app defined it.
 * @param pathname - The current pathname.
 * @returns A new tree with `isActive` resolved on every item.
 */
export function resolveActiveItems(config: NavigationConfig, pathname: string): NavigationConfig {
  const resolve = (items: NavigationItem[]): NavigationItem[] =>
    items.map((item) => ({
      ...item,
      isActive: item.isActive ?? item.url === pathname,
      ...(item.children ? { children: resolve(item.children) } : {}),
    }));

  return { ...config, groups: config.groups.map((group) => ({ ...group, items: resolve(group.items) })) };
}

/** Breadcrumbs together with the page that set them. */
interface PageBreadcrumbs {
  readonly pathname: string;
  readonly items: BreadcrumbData[];
}

const NO_BREADCRUMBS: BreadcrumbData[] = [];

/**
 * Provides the navigation tree and the current page's breadcrumbs.
 *
 * Both are derived during render rather than copied into state by effects:
 * the active item follows the pathname, and breadcrumbs belong to the page
 * that set them, so they disappear on navigation without a reset.
 */
export function NavigationProvider({ children, initialNavigation }: NavigationProviderProps) {
  const pathname = usePathname();
  const [pageBreadcrumbs, setPageBreadcrumbs] = useState<PageBreadcrumbs>();

  const navigation = useMemo(() => resolveActiveItems(initialNavigation, pathname), [initialNavigation, pathname]);
  const breadcrumbs = pageBreadcrumbs?.pathname === pathname ? pageBreadcrumbs.items : NO_BREADCRUMBS;

  const setBreadcrumbs = useCallback(
    (items: BreadcrumbData[]) => setPageBreadcrumbs({ pathname, items }),
    [pathname],
  );
  const clearBreadcrumbs = useCallback(() => setPageBreadcrumbs(undefined), []);

  const value = useMemo(
    () => ({ navigation, breadcrumbs, setBreadcrumbs, clearBreadcrumbs }),
    [navigation, breadcrumbs, setBreadcrumbs, clearBreadcrumbs],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
