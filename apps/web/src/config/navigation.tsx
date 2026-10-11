import { CreditCard, Home, UserRound, type LucideIcon } from 'lucide-react';

import type { NavigationConfig } from '@app/ui';

function navIcon(Icon: LucideIcon) {
  return <Icon aria-hidden strokeWidth={1.75} />;
}

/** The home page's URL; it is current only on an exact match. */
const ROOT_URL = '/';

/**
 * Whether a nav item is the page being viewed: its own URL or anything under
 * it. Home matches only itself, or it would be current everywhere.
 *
 * @param url - The nav item's URL.
 * @param pathname - The current pathname.
 */
export function isCurrentNavItem(url: string, pathname: string): boolean {
  if (url === ROOT_URL) return pathname === ROOT_URL;
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * Sidebar navigation, with the current page's item marked active.
 *
 * @param pathname - The current pathname.
 */
export function createNavigationConfig(pathname: string): NavigationConfig {
  const item = (id: string, title: string, url: string, icon: LucideIcon) => ({
    id,
    title,
    url,
    icon: navIcon(icon),
    isActive: isCurrentNavItem(url, pathname),
  });

  return {
    groups: [
      {
        id: 'main',
        title: 'Menu',
        items: [
          // EXAMPLE: notes. Home shows the example; point it at your own first screen.
          item('home', 'Home', ROOT_URL, Home),
          // Extension point: your product's pages go here, each with its own
          // page under src/app/(app)/ and its code under src/features/.
          item('billing', 'Billing', '/billing', CreditCard),
          item('account', 'Account', '/account', UserRound),
        ],
      },
    ],
  };
}
