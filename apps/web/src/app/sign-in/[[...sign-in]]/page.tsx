import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';

import { AuthPage } from '@/components/AuthPage';

export const metadata: Metadata = { title: 'Sign in' };

/** Sign in: Clerk's `<SignIn />` on its optional catch-all route. Open to signed-out visitors. */
export default function SignInPage() {
  return (
    <AuthPage>
      <SignIn />
    </AuthPage>
  );
}
