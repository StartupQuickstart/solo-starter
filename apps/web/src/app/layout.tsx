import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { APP_CONFIG } from '@/config/app.config';
import { AUTH_ROUTES } from '@/lib/auth-routes';
import { AppProviders } from '@/lib/providers';

// The two typefaces, self-hosted from the packages: nothing is fetched from a font service.
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/geist';

import './globals.css';

export const metadata: Metadata = {
  // Pages set their own title; the product name is appended to each.
  title: { default: APP_CONFIG.name, template: `%s · ${APP_CONFIG.name}` },
  description: `Sign in to ${APP_CONFIG.name}.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Clerk's provider, inside <body> as its quickstart places it. Sign-in and sign-up are this app's own pages. */}
        <ClerkProvider signInUrl={AUTH_ROUTES.signIn} signUpUrl={AUTH_ROUTES.signUp}>
          {/* Light only: the app has no dark theme. Outside AppProviders, which remounts what is under it when the person changes. */}
          <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
            <AppProviders>{children}</AppProviders>
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
