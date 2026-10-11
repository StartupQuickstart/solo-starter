import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';

import { AuthPage } from '@/components/AuthPage';

export const metadata: Metadata = { title: 'Sign up' };

/** Sign up: Clerk's `<SignUp />` on its optional catch-all route. Open to signed-out visitors. */
export default function SignUpPage() {
  return (
    <AuthPage>
      <SignUp />
    </AuthPage>
  );
}
