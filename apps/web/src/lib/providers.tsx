'use client';

import { useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

/** The cache's key while nobody is signed in. Never a user id: Clerk's start with `user_`. */
const SIGNED_OUT = 'signed-out';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        refetchOnWindowFocus: true,
        staleTime: 60_000,
      },
    },
  });
}

/**
 * The query cache and everything under it, for one person. Mounted with the
 * person as its key, so it lives exactly as long as their session does.
 */
function ScopedQueryCache({ children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  // Empty the cache when its owner goes, dropping its requests in flight.
  useEffect(() => () => queryClient.clear(), [queryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * App-wide providers: the query cache.
 *
 * What the browser holds belongs to one person. Query keys name what is asked
 * for ("notes", "billing"), not who asks, so the cache itself is what is
 * scoped: when the signed-in person changes (sign-out, or someone else signing
 * in in the same tab), the cache and every screen under it are replaced in
 * that same render (the person is their key). Nothing cached or held in
 * component state for one person can be painted for the next, not even for a
 * frame while the new data loads.
 *
 * A new cache alone would not do it: a mounted query keeps reading the cache
 * it started with. An effect that resets the cache would run after the old
 * data had already been shown.
 *
 * @param props.children - The app
 */
export function AppProviders({ children }: AppProvidersProps) {
  const { userId } = useAuth();

  return <ScopedQueryCache key={userId ?? SIGNED_OUT}>{children}</ScopedQueryCache>;
}
