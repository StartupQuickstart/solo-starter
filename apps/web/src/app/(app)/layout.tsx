'use client';

import { UserButton, useAuth } from '@clerk/nextjs';
import { Layout, type LayoutConfig } from '@app/ui';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

import { APP_CONFIG } from '@/config/app.config';
import { createNavigationConfig } from '@/config/navigation';
// KIT CARD: remove this import.
import { kitSidebarFooter } from '@/features/kit-upgrade/KitUpgradeCard';

const layoutConfig: LayoutConfig = {
  logo: {
    // The sidebar is dark: always the on-dark variant.
    src: APP_CONFIG.logo.srcOnDark,
    srcDark: APP_CONFIG.logo.srcOnDark,
    alt: APP_CONFIG.name,
    width: APP_CONFIG.logo.width,
    height: APP_CONFIG.logo.height,
  },
  themeToggle: false,
};

/** Where "Manage account" in Clerk's menu goes: the Account page, not a modal over the current one. */
const ACCOUNT_PATH = '/account';

/**
 * The signed-in shell: sidebar, header and the page. The header's account
 * control is Clerk's `<UserButton />`. Each page under it checks the session
 * itself (`auth.protect()`).
 *
 * Page content is held back until Clerk has loaded in the browser. Otherwise a
 * page would fire its first requests before there is a session token to send,
 * and the API would refuse them.
 *
 * @param props.children - The page
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();
  const pathname = usePathname();
  const navigation = useMemo(() => createNavigationConfig(pathname), [pathname]);

  return (
    <Layout
      navigation={navigation}
      layoutConfig={layoutConfig}
      userMenu={<UserButton userProfileMode="navigation" userProfileUrl={ACCOUNT_PATH} />}
      // KIT CARD: remove this prop. It puts the application kit card at the foot of the sidebar.
      sidebarFooter={kitSidebarFooter()}
    >
      {isLoaded ? children : null}
    </Layout>
  );
}
