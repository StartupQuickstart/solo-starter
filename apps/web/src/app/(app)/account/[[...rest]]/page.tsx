import { UserProfile } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { PageSection, PageWrapper } from '@app/ui';
import type { Metadata } from 'next';

import { OPEN_SOURCE_NOTICES_PATH } from '@/lib/auth-routes';

export const metadata: Metadata = { title: 'Account' };

// Rendered per request: the page needs the session, and the build has no session.
export const dynamic = 'force-dynamic';

/** Where this page is mounted. Clerk's component adds its own sections under it (`/account/security`). */
const ACCOUNT_PATH = '/account';


/**
 * Account: Clerk's `<UserProfile />` (name, email addresses, password,
 * sign-in methods, devices, deleting the account), routed by path on this
 * optional catch-all route. Signed-in people only.
 */
export default async function AccountPage() {
  await auth.protect();

  return (
    <PageWrapper>
      <PageSection variant="content">
        {/* The page's heading is the component's own ("Account"). */}
        <UserProfile path={ACCOUNT_PATH} routing="path" />
        <p className="text-muted-foreground mt-6 text-xs">
          <a href={OPEN_SOURCE_NOTICES_PATH}className="underline-offset-4 hover:underline">
            Open source notices
          </a>
        </p>
      </PageSection>
    </PageWrapper>
  );
}
