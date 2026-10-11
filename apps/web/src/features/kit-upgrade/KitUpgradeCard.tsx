'use client';

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@app/ui';
import { UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';

import { APP_CONFIG } from '@/config/app.config';

import { KIT_CARD, KIT_LINK_LABEL, KIT_URL, NEW_TAB_HINT } from './kit-content';
import { UPGRADE_PATH } from './kit-flag';
import { KitExternalLink } from './KitExternalLink';

/** The sidebar's own focus ring (lime on the ink panel), in place of the button's cobalt one. */
const SIDEBAR_FOCUS_RING = 'focus-visible:ring-sidebar-ring focus-visible:ring-2';

/**
 * The card at the icon-rail width: one icon that goes to the application
 * kit's page, with the destination as its tooltip and its accessible name.
 */
function KitUpgradeIconLink() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={KIT_LINK_LABEL}>
          <a href={KIT_URL} target="_blank" rel="noopener noreferrer">
            <UsersRound aria-hidden strokeWidth={1.75} />
            <span className="sr-only">
              {KIT_LINK_LABEL} {NEW_TAB_HINT}
            </span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * The application kit card, for the foot of the sidebar: what the paid
 * sibling of this starter adds, a link to its page and a link to the in-app
 * comparison.
 *
 * It follows the sidebar: the full card in the open panel and in the phone's
 * menu, one icon when the sidebar is collapsed to icons. It is a link and
 * some text: it sends nothing, stores nothing and cannot be dismissed, and it
 * is switched off with `NEXT_PUBLIC_SHOW_KIT_CARD=0`.
 */
export function KitUpgradeCard() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const titleId = useId();

  // The phone's menu is always the full panel, whatever the desktop sidebar was left as.
  if (state === 'collapsed' && !isMobile) return <KitUpgradeIconLink />;

  // On a phone the sidebar is a sheet over the page: following the in-app link closes it.
  const closeMobileMenu = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <aside
      aria-labelledby={titleId}
      // The least width keeps the words from re-wrapping line by line while the panel's width animates open.
      className="bg-sidebar-accent border-sidebar-border w-full min-w-52 rounded-xl border p-3.5"
    >
      <p id={titleId} className="font-display text-sidebar-accent-foreground text-[0.9375rem] font-semibold leading-snug tracking-[-0.015em]">
        {KIT_CARD.title}
      </p>
      {/* On a very short screen the card keeps its title and links and gives the room to the navigation. */}
      <div className="[@media(max-height:35rem)]:hidden">
        <p className="mt-1.5 text-[0.8125rem] leading-snug">{KIT_CARD.lead}</p>
        <ul className="mt-2.5 space-y-1.5 text-[0.8125rem] leading-snug">
          {KIT_CARD.points.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <span aria-hidden className="bg-signal mt-[0.4375rem] size-1 shrink-0 rounded-full" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3.5 flex flex-col gap-1">
        <KitExternalLink href={KIT_URL} label={KIT_LINK_LABEL} variant="secondary" size="sm" className={`w-full ${SIDEBAR_FOCUS_RING}`} />
        <Link
          href={UPGRADE_PATH}
          onClick={closeMobileMenu}
          className="ring-sidebar-ring hover:text-sidebar-accent-foreground flex h-8 items-center justify-center rounded-md text-[0.8125rem] font-medium underline-offset-4 outline-hidden transition-colors hover:underline focus-visible:ring-2"
        >
          {KIT_CARD.compareLabel}{' '}
          <span className="sr-only">{KIT_CARD.compareContext}</span>
        </Link>
      </div>
    </aside>
  );
}

/**
 * What the signed-in shell puts at the foot of its sidebar: the card, or
 * nothing in a build with `NEXT_PUBLIC_SHOW_KIT_CARD=0`.
 */
export function kitSidebarFooter(): ReactNode {
  return APP_CONFIG.showKitCard ? <KitUpgradeCard /> : undefined;
}
