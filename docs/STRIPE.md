# Billing with Stripe

Billing is optional. Without the three Stripe variables the app runs, nobody
is subscribed, the Billing page says billing is switched off, and the
endpoints that need Stripe answer `503 BILLING_NOT_CONFIGURED`.

Nothing in this document has been run against a real Stripe account in this
repository. The code is covered by tests that use an in-memory stand-in for
Stripe. [MANUAL-TESTING.md](MANUAL-TESTING.md) has the steps to prove it
against your sandbox.

## What is sold

One plan: a recurring price, per user. One user, one Stripe customer, one
subscription. Stripe hosts both screens: Checkout to subscribe, and the
customer portal to change the card, see invoices or cancel.

The plan is two settings on the API: `STRIPE_PRICE_ID`, the price Checkout
sells, and `BILLING_PLAN_NAME`, what the Billing page calls it (default
"Pro"). The amount shown on the page is read from the price in Stripe.

## Set up a sandbox

1. In the Stripe Dashboard, open a sandbox and copy its secret key. Sandbox
   secret keys start with `sk_test_` ([Stripe: API keys](https://docs.stripe.com/keys)).
   Put it in `apps/api/.env` as `STRIPE_SECRET_KEY`.

2. Create the one product and its price. In the Dashboard: Product catalog,
   Add product, give it a name, add a **recurring** price (monthly, for
   example), save, then open the price and copy its id. It starts with
   `price_`. Or with the [Stripe CLI](https://docs.stripe.com/cli):

   ```bash
   stripe products create --name "Pro"
   stripe prices create --product <the product id> --currency usd --unit-amount 900 --recurring.interval month
   ```

   Put the price id in `apps/api/.env` as `STRIPE_PRICE_ID`. To change the
   amount later, create a new price and change the variable: Stripe prices
   cannot have their amount edited. People who subscribed at the old price
   keep it and still count as subscribed.

3. Forward webhooks to the local API with the
   [Stripe CLI](https://docs.stripe.com/cli/listen):

   ```bash
   stripe login
   stripe listen --forward-to http://localhost:4000/api/webhooks/stripe
   ```

   `stripe listen` prints a signing secret that starts with `whsec_`. Put it
   in `apps/api/.env` as `STRIPE_WEBHOOK_SECRET` and restart the API. The
   secret stays the same between restarts of `stripe listen`.

4. Configure the customer portal for the sandbox in the Stripe Dashboard. The
   portal has its own settings per sandbox and for live mode, and it shows
   only what you allow: allow cancellation and payment method updates
   ([Stripe: Integrate the customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal)).

Set the three variables together. With only some of them the API refuses to
start and says which are missing.

For a deployed API, create a webhook endpoint in the Stripe Dashboard at
`https://<your api>/api/webhooks/stripe` for these four events, and use
that endpoint's signing secret:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## How a purchase works

1. The user opens Billing in the web client and chooses Subscribe.
2. The client calls `POST /api/v1/billing/checkout`. The API creates the
   user's Stripe customer if they have none, creates a
   [Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
   in `subscription` mode for the price, and returns its URL.
3. The browser goes to Stripe. After payment Stripe sends it back to
   `<APP_URL>/billing?checkout=success`, or `?checkout=canceled`.
4. Stripe calls the webhook. The API writes the subscription to the user.
5. The Billing page shows the subscription.

Step 3 usually arrives before step 4, so the page waits for the webhook
before it shows the new state; a reload shows the current state at any time.

A user who is already subscribed cannot start a second Checkout (the API
answers `409 ALREADY_SUBSCRIBED`). They change their card or cancel in the
customer portal, opened by `POST /api/v1/billing/portal`.

The return URLs are built from `APP_URL`, never from the request.

## The webhook owns subscription state

Four columns on `users` hold it: `stripe_subscription_id`,
`subscription_status`, `subscription_current_period_end` and
`subscription_cancel_at_period_end`. One function writes them,
`BillingService.syncFromStripe`, and only the webhook calls it. Starting a
Checkout does not make anyone subscribed, and neither does returning from one.

The handler in `apps/api/src/api/v1/webhooks/stripe/stripe.routes.ts`:

1. **Verifies the signature** against the raw request body. An unsigned or
   altered request gets `400`.
2. **Skips events it has already processed.** Event ids are recorded in the
   `stripe_webhook_events` table. Stripe can deliver an event more than once
   and recommends recording processed ids
   ([Stripe: Webhooks](https://docs.stripe.com/webhooks)).
3. **Ignores the event's payload and asks Stripe for the current state.** It
   locks the user's row, lists the customer's subscriptions, and stores what
   it finds. Stripe does not guarantee that events arrive in the order they
   happened (same page), so the payload of the event in hand may already be
   out of date. Reading the current state makes the outcome the same whatever
   order events arrive in. The row lock stops two deliveries for one user
   from interleaving.
4. **Records failures and answers `500`**, so Stripe retries the event.

The customer, the Checkout Session and the subscription are each tagged with
the user's id, which is how the webhook finds the row.

## Is this user subscribed

One rule, `isSubscribed` in `apps/api/src/lib/billing/subscription.ts`, used
wherever a status is interpreted:

| Subscription status | Subscribed |
|---|---|
| `active`, `trialing` | yes |
| `past_due` | yes. A renewal payment failed and Stripe is still retrying it. |
| anything else (`canceled`, `unpaid`, `incomplete`, ...) or none | no |

`past_due` keeps access because Stripe's guidance is to notify the customer
on `past_due` and revoke access on `canceled` or `unpaid`
([Stripe: Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)).
How long a subscription stays `past_due` is set by your retry settings in the
Stripe Dashboard. To cut access at the first failed payment, remove
`PAST_DUE` from `SUBSCRIBED_STATUSES` in that file.

## Gating a feature

The example is exporting notes as CSV. On the API, one middleware in front of
the route (`apps/api/src/api/v1/notes/notes.routes.ts`):

```ts
import { createRequireSubscription, createStoredSubscriptionReader } from '@/api/middleware/require-subscription';

const requireSubscription = createRequireSubscription(createStoredSubscriptionReader(prisma));

router.get('/export', requireSubscription, (req, res) => controller.exportCsv(req, res));
```

A user who is not subscribed gets `403 SUBSCRIPTION_REQUIRED`. The web client
shows the Export button locked, with a link to Billing, for anyone the
Billing endpoint says is not subscribed
(`apps/web/src/features/notes/NotesView.tsx`). The lock in the browser is a
courtesy; the API is what enforces it.

## When an account is deleted

When Clerk reports `user.deleted`, the API cancels the user's subscriptions
in Stripe before it soft-deletes the user and their notes, so nobody is
charged for an account that no longer exists
(`apps/api/src/api/v1/webhooks/clerk/clerk-sync.service.ts`). This needs the
Clerk webhook to be set up ([SETUP.md](SETUP.md)).

## The API version is pinned

`STRIPE_API_VERSION` in `apps/api/src/lib/billing/stripe-gateway.ts` is the
version the installed `stripe` package was built for. The compiler checks
that it matches the package, so upgrading the package without revisiting the
pin fails the type-check. A webhook endpoint created in the Dashboard has its
own API version; the handler does not depend on it, because it does not read
event payloads beyond the ids.

## Going live

Not done in this repository. Before taking payments: create the product and
price in live mode, create the live webhook endpoint, configure the live
customer portal, set the three live values on the host, and make one real
purchase and one cancellation.
