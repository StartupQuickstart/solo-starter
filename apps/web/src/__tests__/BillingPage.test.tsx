import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { BILLING_OFF, NOT_SUBSCRIBED, SUBSCRIBED, envelope, failure } from '@/__tests__/helpers/fixtures';
import { renderWithQueryClient } from '@/__tests__/helpers/render';
import { BillingView } from '@/components/pages/BillingView';
import { CHECKOUT_RESULT, parseCheckoutResult } from '@/lib/billing/checkout-result';

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const PORTAL_URL = 'https://stripe.test/portal';
const CHECKOUT_URL = 'https://stripe.test/checkout';

let portalRequests = 0;
let checkoutRequests = 0;

const server = setupServer(
  http.get('*/api/v1/billing', () => HttpResponse.json(envelope(NOT_SUBSCRIBED))),
  http.post('*/api/v1/billing/checkout', () => {
    checkoutRequests += 1;
    return HttpResponse.json(envelope({ url: CHECKOUT_URL }));
  }),
  http.post('*/api/v1/billing/portal', () => {
    portalRequests += 1;
    return HttpResponse.json(envelope({ url: PORTAL_URL }));
  }),
);

function serveBilling(data: object) {
  server.use(http.get('*/api/v1/billing', () => HttpResponse.json(envelope(data))));
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  portalRequests = 0;
  checkoutRequests = 0;
});
afterAll(() => server.close());

/** Stands in for leaving the app: records where the view would send the browser. */
const redirect = vi.fn<(url: string) => void>();

describe('BillingView: not subscribed', () => {
  it("shows the plan's name and price, and that the person is not subscribed", async () => {
    renderWithQueryClient(<BillingView redirect={redirect} />);

    const plan = await screen.findByRole('region', { name: 'The plan' });
    expect(plan).toHaveTextContent('Pro');
    expect(plan).toHaveTextContent('$9 per month');
    expect(plan).toHaveTextContent('Not subscribed');
    expect(screen.queryByText(/renews on/i)).not.toBeInTheDocument();
  });

  it('sends the person to Stripe Checkout when they subscribe', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<BillingView redirect={redirect} />);

    await user.click(await screen.findByRole('button', { name: 'Subscribe' }));

    await waitFor(() => expect(redirect).toHaveBeenCalledWith(CHECKOUT_URL));
    expect(checkoutRequests).toBe(1);
    // Stays busy: the browser is leaving for Stripe.
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
  });

  it('does not offer the billing page to someone Stripe has never seen', async () => {
    renderWithQueryClient(<BillingView redirect={redirect} />);

    await screen.findByRole('button', { name: 'Subscribe' });
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
  });

  it('reports a failure to open Checkout and lets the person try again', async () => {
    server.use(
      http.post('*/api/v1/billing/checkout', () =>
        HttpResponse.json(failure('BILLING_NOT_CONFIGURED', 'Billing is not set up'), { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<BillingView redirect={redirect} />);

    await user.click(await screen.findByRole('button', { name: 'Subscribe' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Billing is not set up'));
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
  });

  it('offers both ways forward to someone whose subscription has ended', async () => {
    serveBilling({ ...NOT_SUBSCRIBED, status: 'canceled' });
    renderWithQueryClient(<BillingView redirect={redirect} />);

    expect(await screen.findByText('Canceled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeEnabled();
  });
});

describe('BillingView: subscribed', () => {
  it('shows the status and the renewal date, and no way to subscribe twice', async () => {
    serveBilling(SUBSCRIBED);
    renderWithQueryClient(<BillingView redirect={redirect} />);

    expect(await screen.findByText('Renews on October 27, 2026')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your plan' })).toHaveTextContent('Pro');
    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument();
  });

  it('says when the subscription is set to end instead of renew', async () => {
    serveBilling({ ...SUBSCRIBED, cancelAtPeriodEnd: true });
    renderWithQueryClient(<BillingView redirect={redirect} />);

    expect(await screen.findByText('Ends on October 27, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/renews on/i)).not.toBeInTheDocument();
  });

  it('warns that the plan is at risk when the last payment failed', async () => {
    serveBilling({ ...SUBSCRIBED, status: 'past_due' });
    renderWithQueryClient(<BillingView redirect={redirect} />);

    expect(await screen.findByText('Past Due')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Your last payment did not go through');
  });

  it('opens the Stripe customer portal from Manage billing', async () => {
    serveBilling(SUBSCRIBED);
    const user = userEvent.setup();
    renderWithQueryClient(<BillingView redirect={redirect} />);

    await user.click(await screen.findByRole('button', { name: 'Manage billing' }));

    await waitFor(() => expect(redirect).toHaveBeenCalledWith(PORTAL_URL));
    expect(portalRequests).toBe(1);
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeDisabled();
  });

  it('reports a failure to open the portal and lets the person try again', async () => {
    serveBilling(SUBSCRIBED);
    server.use(
      http.post('*/api/v1/billing/portal', () => HttpResponse.json(failure('NO_CUSTOMER', 'There is no billing account yet'), { status: 409 })),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<BillingView redirect={redirect} />);

    await user.click(await screen.findByRole('button', { name: 'Manage billing' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('There is no billing account yet'));
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeEnabled();
  });
});

describe('BillingView: billing switched off', () => {
  it('says so plainly and offers nothing to press', async () => {
    serveBilling(BILLING_OFF);
    renderWithQueryClient(<BillingView redirect={redirect} />);

    expect(await screen.findByRole('heading', { name: 'Billing is switched off' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('BillingView: loading and failing', () => {
  it('offers a retry when billing fails to load', async () => {
    server.use(http.get('*/api/v1/billing', () => HttpResponse.json(failure(), { status: 500 })));
    renderWithQueryClient(<BillingView redirect={redirect} />);

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load billing");
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('BillingView: returning from Checkout', () => {
  it('says the plan is being activated, then confirms it once the API reports the subscription', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/billing', () => {
        reads += 1;
        // The webhook lands between the first and the second read.
        return HttpResponse.json(envelope(reads === 1 ? NOT_SUBSCRIBED : SUBSCRIBED));
      }),
    );
    renderWithQueryClient(<BillingView redirect={redirect} checkoutResult={CHECKOUT_RESULT.success} />);

    expect(await screen.findByRole('status')).toHaveTextContent('your plan is being activated');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('You are now on the Pro plan.'), { timeout: 5_000 });
  });

  it('does not re-read billing when the page was opened normally', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/billing', () => {
        reads += 1;
        return HttpResponse.json(envelope(NOT_SUBSCRIBED));
      }),
    );
    renderWithQueryClient(<BillingView redirect={redirect} />);

    await screen.findByText('Not subscribed');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(reads).toBe(1);
  });

  it('says nothing was charged when Checkout was canceled', async () => {
    renderWithQueryClient(<BillingView redirect={redirect} checkoutResult={CHECKOUT_RESULT.canceled} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Checkout was canceled. You have not been charged.');
  });
});

describe('parseCheckoutResult', () => {
  it('accepts the two values Stripe returns with and ignores anything else', () => {
    expect(parseCheckoutResult('success')).toBe(CHECKOUT_RESULT.success);
    expect(parseCheckoutResult('canceled')).toBe(CHECKOUT_RESULT.canceled);
    expect(parseCheckoutResult('paid')).toBeUndefined();
    expect(parseCheckoutResult(['success'])).toBeUndefined();
    expect(parseCheckoutResult(undefined)).toBeUndefined();
  });
});
