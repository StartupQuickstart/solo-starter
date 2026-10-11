// KIT CARD: delete this folder (src/app/(app)/upgrade). The page belongs to src/features/kit-upgrade.
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { APP_CONFIG } from '@/config/app.config';
import { KIT_UPGRADE_PAGE } from '@/features/kit-upgrade/kit-content';
import { KitUpgradeView } from '@/features/kit-upgrade/KitUpgradeView';

export const metadata: Metadata = { title: KIT_UPGRADE_PAGE.title };

// Rendered per request: the page needs the session, and the build has no session.
export const dynamic = 'force-dynamic';

/**
 * What the application kit adds to this starter. Signed-in people only;
 * everyone else is sent to sign in.
 *
 * In a build with `NEXT_PUBLIC_SHOW_KIT_CARD=0` the address never reaches
 * this page: `next.config.ts` sends it to one that does not exist, for a real
 * 404. The check here is the second line, should that rule ever be lost.
 */
export default async function UpgradePage() {
  await auth.protect();
  if (!APP_CONFIG.showKitCard) notFound();
  return <KitUpgradeView />;
}
