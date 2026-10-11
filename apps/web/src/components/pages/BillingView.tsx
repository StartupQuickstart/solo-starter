'use client';

import { format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarX2, Check, CheckCircle2, Info, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, Skeleton, StatusPill } from '@app/ui';

import { ErrorState } from '@/components/ui/ErrorState';
import { SettingsPage } from '@/components/ui/SettingsPage';
import { APP_CONFIG } from '@/config/app.config';
import type { Billing } from '@/lib/billing/billing-model';
import { CHECKOUT_RESULT, type CheckoutResult } from '@/lib/billing/checkout-result';
import { useBilling, useCheckout, usePortal } from '@/lib/hooks/useBilling';

/** Stripe's status for a subscription whose last payment failed and is being retried. */
const STATUS_PAST_DUE = 'past_due';

/** What the plan unlocks, in the reader's words. */
const PLAN_INCLUDES: readonly string[] = [
  // EXAMPLE: notes. The one gated feature; list what your plan unlocks instead.
  'Export your notes as a CSV file',
];

/** Formats an ISO date as e.g. `October 27, 2026`. */
function longDate(iso: string): string {
  return format(parseISO(iso), 'MMMM d, yyyy');
}

function SupportLink() {
  return (
    <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-primary font-medium underline-offset-4 hover:underline">
      {APP_CONFIG.supportEmail}
    </a>
  );
}

/** A line with an icon in front of it. */
function IconLine({ icon: Icon, children, className }: { readonly icon: LucideIcon; readonly children: ReactNode; readonly className?: string }) {
  return (
    <span className={`inline-flex items-start gap-2 ${className ?? ''}`}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{children}</span>
    </span>
  );
}

/** What happened at Checkout, said once at the top of the page. */
function CheckoutNotice({ result, billing }: { readonly result: CheckoutResult; readonly billing: Billing }) {
  if (result === CHECKOUT_RESULT.canceled) {
    return (
      <p role="status" className="bg-card flex items-start gap-3 rounded-xl px-5 py-4 text-sm shadow-xs">
        <Info aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        Checkout was canceled. You have not been charged.
      </p>
    );
  }

  return (
    <p role="status" className="bg-success-soft ring-success/15 flex items-start gap-3 rounded-xl px-5 py-4 text-sm ring-1 ring-inset">
      <CheckCircle2 aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
      {billing.subscribed
        ? `Thank you. You are now on the ${billing.plan.name} plan.`
        : 'Thank you. Your payment went through and your plan is being activated. This usually takes a few seconds.'}
    </p>
  );
}

/** When the subscription renews or ends. */
function PeriodLine({ billing }: { readonly billing: Billing }) {
  if (!billing.currentPeriodEnd) return null;
  if (billing.cancelAtPeriodEnd) {
    return (
      <IconLine icon={CalendarX2} className="text-warning font-medium">
        Ends on {longDate(billing.currentPeriodEnd)}
      </IconLine>
    );
  }
  return (
    <IconLine icon={RefreshCw} className="text-muted-foreground">
      Renews on {longDate(billing.currentPeriodEnd)}
    </IconLine>
  );
}

/** Shown when the API has no Stripe keys: the app works, and there is nothing to buy. */
function BillingOffNotice() {
  return (
    <section aria-labelledby="billing-off-heading" className="bg-card rounded-xl px-6 py-7 shadow-xs sm:px-8">
      <h2 id="billing-off-heading" className="text-[1.0625rem] font-semibold">
        Billing is switched off
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-xl text-sm">
        Subscriptions are not available here yet, so nothing is being charged. If you expected to see a plan, write to <SupportLink />.
      </p>
    </section>
  );
}

interface PlanCardProps {
  readonly billing: Billing;
  /** Set while the browser is on its way to Stripe. */
  readonly isLeaving: boolean;
  readonly onSubscribe: () => void;
  readonly onManage: () => void;
}

/**
 * The one plan and where the person stands with it: its name and price with
 * the way to subscribe, or the subscription's status and next date with the
 * way into the customer portal.
 */
function PlanCard({ billing, isLeaving, onSubscribe, onManage }: PlanCardProps) {
  const { plan, subscribed, status } = billing;

  return (
    <section aria-labelledby="plan-heading" className="bg-card overflow-hidden rounded-xl shadow-md">
      {status === STATUS_PAST_DUE && (
        <p role="alert" className="bg-danger-soft text-destructive flex items-start gap-3 px-6 py-3.5 text-sm font-medium sm:px-8">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          Your last payment did not go through. Update your payment method under Manage billing to keep your plan.
        </p>
      )}

      <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 id="plan-heading" className="text-muted-foreground font-sans text-sm font-medium tracking-normal">
            {subscribed ? 'Your plan' : 'The plan'}
          </h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.03em]">{plan.name}</p>
            {status ? <StatusPill status={status} surface="light" /> : <span className="text-muted-foreground text-sm">Not subscribed</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {plan.priceLabel && <span className="font-semibold tabular-nums">{plan.priceLabel}</span>}
            {subscribed && <PeriodLine billing={billing} />}
            {subscribed && billing.cancelAtPeriodEnd && <span className="text-muted-foreground">You keep the plan until then.</span>}
          </div>
          <ul aria-label={`Included in ${plan.name}`} className="mt-5 space-y-2">
            {PLAN_INCLUDES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm">
                <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 self-start md:self-center">
          {!subscribed && (
            <Button onClick={onSubscribe} disabled={isLeaving}>
              Subscribe
            </Button>
          )}
          {/* A status means Stripe knows this person, so the portal has something to show. */}
          {status !== null && (
            <Button variant={subscribed ? 'default' : 'outline'} onClick={onManage} disabled={isLeaving}>
              Manage billing
            </Button>
          )}
        </div>
      </div>

      <p className="bg-muted/50 text-muted-foreground border-t px-6 py-3.5 text-sm sm:px-8">
        {subscribed
          ? 'Your card, your invoices and cancelling are handled on a secure billing page, run by Stripe.'
          : 'Payment is taken on a secure checkout page, run by Stripe. Cancel any time.'}
      </p>
    </section>
  );
}

function BillingSkeleton() {
  return (
    <div aria-label="Loading billing">
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

/** Sends the browser to a page outside the app (Stripe's hosted pages). */
function leaveForUrl(url: string): void {
  window.location.assign(url);
}

export interface BillingViewProps {
  /** How the browser returned from Checkout, from the page's query string. */
  readonly checkoutResult?: CheckoutResult | undefined;
  /** How the view leaves for a Stripe-hosted page. Injected in tests. */
  readonly redirect?: (url: string) => void;
}

/**
 * Billing: the one plan, whether the signed-in person is subscribed to it,
 * and the way to Stripe Checkout (to subscribe) or the Stripe customer portal
 * (to change the card, read invoices or cancel).
 *
 * Nothing here changes the subscription. Both buttons hand the browser to
 * Stripe. After a purchase the page re-reads billing until Stripe has
 * confirmed it to the API.
 */
export function BillingView({ checkoutResult, redirect = leaveForUrl }: BillingViewProps = {}) {
  const status = useBilling({ awaitSubscription: checkoutResult === CHECKOUT_RESULT.success });
  const checkout = useCheckout();
  const portal = usePortal();

  const leave = (mutation: typeof checkout, fallback: string) => {
    mutation.mutate(undefined, {
      onSuccess: ({ url }) => redirect(url),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : fallback);
      },
    });
  };

  const billing = status.data;
  // Stays set after success too: the browser is leaving for Stripe.
  const isLeaving = checkout.isPending || checkout.isSuccess || portal.isPending || portal.isSuccess;

  return (
    <SettingsPage title="Billing" description="Your plan, payment method and invoices.">
      {status.isLoading ? (
        <BillingSkeleton />
      ) : status.error || !billing ? (
        <ErrorState what="billing" onRetry={() => void status.refetch()} />
      ) : !billing.billingEnabled ? (
        <BillingOffNotice />
      ) : (
        <div className="space-y-4">
          {checkoutResult && <CheckoutNotice result={checkoutResult} billing={billing} />}
          <PlanCard
            billing={billing}
            isLeaving={isLeaving}
            onSubscribe={() => leave(checkout, 'Could not open checkout')}
            onManage={() => leave(portal, 'Could not open the billing page')}
          />
        </div>
      )}
    </SettingsPage>
  );
}
