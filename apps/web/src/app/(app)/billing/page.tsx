import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';

import { BillingView } from '@/components/pages/BillingView';
import { parseCheckoutResult } from '@/lib/billing/checkout-result';

export const metadata: Metadata = { title: 'Billing' };

// Rendered per request: the page needs the session, and the build has no session.
export const dynamic = 'force-dynamic';

interface BillingPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Billing. Signed-in people only; everyone else is sent to sign in.
 *
 * Stripe Checkout returns here with `?checkout=success` or `?checkout=canceled`.
 */
export default async function BillingPage({ searchParams }: BillingPageProps) {
  await auth.protect();
  const { checkout } = await searchParams;
  return <BillingView checkoutResult={parseCheckoutResult(checkout)} />;
}
