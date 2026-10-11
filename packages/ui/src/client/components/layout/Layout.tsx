'use client';

import type { ReactNode } from 'react';

import {
  HeaderActionsProvider,
  LayoutConfigProvider,
  NavigationProvider,
  type LayoutConfig,
  type NavigationConfig,
} from '../../contexts';
import { SidebarInset, SidebarProvider } from '../ui/sidebar';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';

export interface LayoutProps {
  children: ReactNode;
  /** The sidebar's navigation tree. */
  navigation: NavigationConfig;
  /** Layout configuration (logo, etc.) */
  layoutConfig?: LayoutConfig;
  /** The header's account control, connected to the app's session. */
  userMenu?: ReactNode;
  /** The header's tool buttons, grouped apart from the account control. */
  headerTools?: ReactNode;
  /**
   * Shown at the foot of the sidebar, under the navigation. It is inside the
   * sidebar in every form: the panel, the icon rail and the phone's menu.
   * Read `useSidebar()` in it to draw each form. Omit it for no footer.
   */
  sidebarFooter?: ReactNode;
}

/**
 * The signed-in shell: sidebar, header and the page area.
 *
 * It holds no session of its own. The app passes the header control that
 * depends on who is signed in, so this package does not import an auth
 * provider.
 *
 * The shell fills the viewport below `--shell-offset` (0 when unset), which
 * leaves room for a bar an app pins to the top of every screen.
 */
export function Layout({ children, navigation, layoutConfig, userMenu, headerTools, sidebarFooter }: LayoutProps) {
  return (
    <LayoutConfigProvider config={layoutConfig}>
      <HeaderActionsProvider>
        <NavigationProvider initialNavigation={navigation}>
          <SidebarProvider>
            <AppSidebar footer={sidebarFooter} />
            <SidebarInset className="flex h-[calc(100svh-1rem-var(--shell-offset,0px))] flex-col overflow-hidden">
              <AppHeader userMenu={userMenu} tools={headerTools} />
              <main className="relative flex flex-1 flex-col overflow-auto">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </NavigationProvider>
      </HeaderActionsProvider>
    </LayoutConfigProvider>
  );
}
