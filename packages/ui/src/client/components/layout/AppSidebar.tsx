'use client';

import * as React from 'react';

import { useLayoutConfig } from '../../contexts/LayoutConfigContext';
import { ConfigurableNavigation } from '../navigation/ConfigurableNavigation';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '../ui/sidebar';
import { Logo } from './Logo';

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /**
   * Shown at the foot of the sidebar, under the navigation: in the panel on a
   * wide screen, in the icon rail when it is collapsed, and in the menu sheet
   * on a phone. What it holds reads the sidebar's state with `useSidebar`.
   */
  readonly footer?: React.ReactNode;
}

export function AppSidebar({ footer, ...props }: AppSidebarProps) {
  const layoutConfig = useLayoutConfig();

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <Logo size="md" className="justify-center px-2 py-1" config={layoutConfig?.logo} />
      </SidebarHeader>
      <SidebarContent>
        <ConfigurableNavigation />
      </SidebarContent>
      {/* Clipped, so the footer is revealed with the panel while its width animates instead of spilling over the page. */}
      {footer != null && <SidebarFooter className="overflow-hidden">{footer}</SidebarFooter>}
      <SidebarRail />
    </Sidebar>
  );
}
