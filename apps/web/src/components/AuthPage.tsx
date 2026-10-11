import type { ReactNode } from 'react';

import { APP_CONFIG } from '@/config/app.config';

/**
 * The plain page Clerk's sign-in and sign-up components sit on: the app's
 * logo (its name, to a screen reader) above, the component centred under it.
 */
export function AuthPage({ children }: { readonly children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG from public/; nothing to optimise */}
      <img src={APP_CONFIG.logo.src} alt={APP_CONFIG.name} width={APP_CONFIG.logo.width} height={APP_CONFIG.logo.height} />
      {children}
    </main>
  );
}
