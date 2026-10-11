# Manual testing checklist

Run this once against your own Clerk development instance and Stripe sandbox
before you rely on the starter.

Every step has a status:

- **Not yet exercised**: nobody has run this step. The code behind it is
  covered by automated tests that use stand-ins for Clerk and Stripe, which is
  not the same as having seen it work.
- **Run in this repository**: done here, with the result stated.

Nothing in this repository has been run with a real Clerk or Stripe account,
so every step that signs in or pays is not yet exercised.

You need two email inboxes you can read (plus-addressing on one account works,
for example `you+one@...` and `you+two@...`), and two browser profiles or one
normal and one private window.

## A. First run

1. `pnpm install`
   Expected: finishes without errors.
   Status: **Run in this repository.** Passes.

2. `pnpm build && pnpm type-check && pnpm lint && pnpm test`
   Expected: all pass. Lint prints warnings in `@app/backend` (its
   `no-explicit-any` rule) and no errors.
   Status: **Run in this repository.** Passes, with no Clerk or Stripe keys set.

3. `pnpm db:up`
   Expected: a container named `solo-starter-postgres` is healthy on port 5442.
   Status: **Not yet exercised.** The integration tests here ran against a
   Postgres 15 started without Docker, not against this container.

4. `pnpm db:migrate`
   Expected: one migration, `20260801000000_init`, is applied.
   Status: **Run in this repository** against that Postgres 15, on an empty
   database.

5. Apply the migration to `app_test` and run `pnpm test:int`
   ([SETUP.md](SETUP.md#8-tests)).
   Expected: every test passes and none is skipped.
   Status: **Run in this repository.** Passes.

6. Start the API with `NODE_ENV=production` and no `CLERK_SECRET_KEY`.
   Expected: it refuses to start and names the variable.
   Status: **Not yet exercised** on a running process. Covered by
   `app.config.test.ts`.

7. Set `STRIPE_SECRET_KEY` without the other two Stripe variables and start
   the API.
   Expected: it refuses to start and names the missing ones.
   Status: **Not yet exercised** on a running process. Covered by
   `app.config.test.ts`.

## B. Signing in

8. With the Clerk keys in both environment files, run `pnpm dev` and open
   <http://localhost:3000>.
   Expected: you are sent to `/sign-in`, which shows Clerk's sign-in component
   under the app's name.
   Status: **Not yet exercised.**

9. Follow the link to sign up, and sign up with the first address.
   Expected: after Clerk's verification step you land on Home, in the sidebar
   layout, with an empty list of notes and a "New note" button. A row for you
   exists in the `users` table.
   Status: **Not yet exercised.**

10. Open `/billing` and `/account` from the sidebar, on a desktop width and on
    a phone width.
    Expected: three navigation entries, Home, Billing and Account. Account
    shows Clerk's profile component. Nothing overflows on the phone width; the
    sidebar opens from the button in the header.
    Status: **Not yet exercised** with Clerk's real components. The layout was
    looked at with stand-ins for them (see the README's note on screenshots).

11. Open the account menu in the header and sign out. Then open
    <http://localhost:3000/billing> directly.
    Expected: you are sent to `/sign-in`, and after signing in, back to
    Billing.
    Status: **Not yet exercised.**

12. In a signed-out window, request the API directly:
    `curl -i http://localhost:4000/api/v1/notes`.
    Expected: `401` with code `UNAUTHORIZED`.
    Status: **Run in this repository** by the integration tests, for every
    route.

## C. Notes (the example)

13. Create a note with a title and a body.
    Expected: the form opens in a dialog; the note appears at the top of the
    list; a reload still shows it.
    Status: **Not yet exercised** in a browser. Covered by the web unit tests
    and the API integration tests.

14. Try to save a note without a title.
    Expected: the dialog stays open and says the title is needed.
    Status: **Not yet exercised** in a browser. Covered by unit tests.

15. Edit the note, then delete it.
    Expected: the edit shows at once; delete asks for confirmation first; the
    note is gone after a reload. In the database its row has `deleted_at` set.
    Status: **Not yet exercised** in a browser. Covered by tests.

16. Sign up with the second address in the other window and open Home.
    Expected: an empty list. The first person's notes are not there.
    Status: **Not yet exercised** in a browser. The API integration tests walk
    every notes route as another user and get `404`, never the row.

17. As the second person, request the first person's note by id, with the
    second person's session token.
    Expected: `404`.
    Status: **Run in this repository** by the integration tests.

18. Sign out as the second person and sign in as the first in the same tab.
    Expected: the first person's notes, with no flash of the other list.
    Status: **Not yet exercised** in a browser. `AppProviders.test.tsx` proves
    the cached data is dropped when the signed-in person changes.

## D. Billing

Set up the sandbox first ([STRIPE.md](STRIPE.md)).

19. Without the Stripe variables, open Billing.
    Expected: a notice that billing is switched off, and no buttons. On Home,
    Export is locked.
    Status: **Not yet exercised** in a browser. Covered by tests.

20. With the three Stripe variables set and `stripe listen` running, open
    Billing.
    Expected: the plan's name, its price as Stripe has it, and a Subscribe
    button.
    Status: **Not yet exercised.**

21. Choose Subscribe and pay with the test card `4242 4242 4242 4242`, any
    future expiry date, any CVC.
    Expected: Stripe's Checkout page, then back on Billing, which shows the
    subscription as active with its renewal date once the webhook has landed.
    The `users` row has `subscription_status = 'active'`.
    Status: **Not yet exercised.**

22. On Home, choose Export CSV.
    Expected: a CSV file of your notes downloads. Before subscribing the
    button was locked with a link to Billing, and
    `GET /api/v1/notes/export` answered `403 SUBSCRIPTION_REQUIRED`.
    Status: **Not yet exercised** in a browser. Both sides of the gate are
    covered by tests.

23. Choose Manage billing and cancel the subscription in Stripe's portal.
    Expected: back on Billing, the subscription is shown as ending on its
    period end date. Export still works until then.
    Status: **Not yet exercised.**

24. In the Stripe Dashboard, cancel the subscription immediately.
    Expected: after the webhook, Billing offers Subscribe again and Export is
    locked.
    Status: **Not yet exercised.**

25. Resend an old event from the Stripe Dashboard (or `stripe events resend`).
    Expected: the API answers 200 and nothing changes.
    Status: **Not yet exercised** against Stripe. Duplicate and out-of-order
    deliveries are covered by `billing.integration.test.ts`.

26. Post to the webhook without a signature:
    `curl -i -X POST http://localhost:4000/api/webhooks/stripe -d '{}'`.
    Expected: `400`.
    Status: **Run in this repository** by the integration tests.

## E. Account changes

Set up the Clerk webhook first ([SETUP.md](SETUP.md#6-clerk-webhook-optional-locally-required-in-production)).

27. Change your name on the Account page.
    Expected: the header shows it at once (Clerk's component), and after the
    webhook the `users` row has it.
    Status: **Not yet exercised.**

28. Subscribe, then delete your account from the Account page.
    Expected: you are signed out. After the webhook the subscription is
    canceled in Stripe, and the `users` row and its notes have `deleted_at`
    set, with the name and email cleared.
    Status: **Not yet exercised** against Clerk and Stripe. Covered by
    `account-deletion.integration.test.ts` with a stand-in for Stripe.

29. Sign up again with the same address.
    Expected: a new, empty account. The old notes do not come back.
    Status: **Not yet exercised.** Covered by the integration tests.

## F. Deploying

30. Build both images: `docker build -f apps/api/Dockerfile .` and
    `docker build -f apps/web/Dockerfile .`, from the repository root.
    Expected: both build.
    Status: **Not yet exercised.** The build steps of both Dockerfiles were
    replayed without Docker on a workstation, with the ignore file applied.

31. Follow [RAILWAY.md](RAILWAY.md) or [RAILWAY-TEMPLATE.md](RAILWAY-TEMPLATE.md).
    Expected: both services pass their health checks, the migration runs
    before the API goes live, and steps 8 to 29 pass against the deployed app.
    Status: **Not yet exercised.** Nothing has been deployed from this
    repository.

32. Open a pull request against your own copy on GitHub.
    Expected: the CI workflow passes without any secret.
    Status: **Not yet exercised.** The same commands pass locally.
