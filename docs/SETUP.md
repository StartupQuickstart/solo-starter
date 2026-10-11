# Setup

How to get the starter running on your machine, in order. Billing is optional
and has its own document, [STRIPE.md](STRIPE.md).

## 1. Install

You need Node.js 24, pnpm 10 and Docker.

```bash
pnpm install
```

## 2. Create a Clerk application

The app cannot be signed into without Clerk keys. Create an application at
[dashboard.clerk.com](https://dashboard.clerk.com); a new application starts
with a development instance, which is the one to use locally.

Settings the app depends on:

1. **Organizations stay off.** This starter is one user per account. Nothing
   in it reads an organization.
2. **Sign-in methods are yours to choose.** The sign-in, sign-up and account
   screens are Clerk's own components, so whatever you enable in the Clerk
   Dashboard (email code, password, a social provider, a passkey) appears
   without a code change.

How the app uses Clerk follows Clerk's documentation for the Next.js App
Router, read on 2026-10-11:

- [Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart):
  `<ClerkProvider>` in `apps/web/src/app/layout.tsx`.
- [`clerkMiddleware()`](https://clerk.com/docs/reference/nextjs/clerk-middleware)
  and [moving off `createRouteMatcher()`](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher):
  `apps/web/src/proxy.ts` (Next.js 16 names the request hook file `proxy`).
- [Protect content](https://clerk.com/docs/nextjs/guides/secure/protect-content):
  each protected page calls `auth.protect()`.
- [Custom sign-in-or-up page](https://clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page)
  and [custom sign-up page](https://clerk.com/docs/nextjs/guides/development/custom-sign-up-page):
  `<SignIn />` and `<SignUp />` on the catch-all routes under
  `apps/web/src/app/sign-in` and `sign-up`, and the four
  `NEXT_PUBLIC_CLERK_*_URL` variables.
- [`<UserProfile />`](https://clerk.com/docs/nextjs/reference/components/user/user-profile)
  on `/account`, and
  [`<UserButton />`](https://clerk.com/docs/nextjs/reference/components/user/user-button)
  in the header.

## 3. Environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Both example files describe every variable. The ones you must fill in:

| File | Variable | Where it comes from |
|---|---|---|
| `apps/api/.env` | `CLERK_SECRET_KEY` | Clerk Dashboard, API keys |
| `apps/api/.env` | `CLERK_PUBLISHABLE_KEY` | Clerk Dashboard, API keys |
| `apps/api/.env` | `CLERK_WEBHOOK_SIGNING_SECRET` | The webhook endpoint you create in step 6. Optional locally. |
| `apps/web/.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | The same publishable key |
| `apps/web/.env.local` | `CLERK_SECRET_KEY` | The same secret key |

The web example already sets the sign-in and sign-up paths
(`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`) and where
to land afterwards (`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`,
`NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`). Leave them as they are.

Neither file is committed: `.env` and `.env.local` are in `.gitignore`.

Each app validates its environment once, at start, and stops with a message
naming the variable when one is missing or malformed:

- API: `apps/api/src/config/app.config.ts`. In production it also requires
  `APP_URL`, `CORS_ORIGIN`, `DATABASE_URL` and `CLERK_SECRET_KEY`. It starts
  without `CLERK_WEBHOOK_SIGNING_SECRET`, because the webhook can only be
  created in Clerk once the API has an address; until the secret is set the
  webhook endpoint refuses every delivery. The three Stripe variables are set
  together or not at all.
- Web: `apps/web/src/config/app.config.ts`.

## 4. Database

```bash
pnpm db:up        # Postgres 16 in Docker, on localhost:5442
pnpm db:migrate   # apply the migration
```

`pnpm db:up` creates two databases: `app` for development and `app_test` for
the integration tests. `pnpm db:down` stops the container and keeps the data.

The Compose project is named `solo-starter`
(`apps/api/docker-compose.yml`). Rename the project, the container and the
volume when you fork, so two copies on one machine do not share containers.

## 5. Run

```bash
pnpm dev
```

- Web client: <http://localhost:3000>
- API: <http://localhost:4000>, health check at <http://localhost:4000/api/v1/health>

Open the web client. You are sent to `/sign-in`; sign up, and you land on
Home with an empty list of notes.

Your row in the API's database is created the first time a signed-in request
arrives, so the app works locally without the Clerk webhook.

## 6. Clerk webhook (optional locally, required in production)

The webhook keeps the database in step with changes made in Clerk: a changed
name or email, and above all a deleted account. When a user is deleted (from
the Account page or the Clerk Dashboard) the API soft-deletes the user and
their notes and cancels their Stripe subscription. The endpoint is
`POST /api/webhooks/clerk` and it handles `user.created`, `user.updated`
and `user.deleted`.

Clerk has to reach the API over the internet, so locally you need a tunnel to
port 4000. Then, following
[Clerk: Sync Clerk data with webhooks](https://clerk.com/docs/guides/development/webhooks/syncing):

1. In the Clerk Dashboard open Webhooks and select Add Endpoint.
2. Set the URL to `https://<your tunnel>/api/webhooks/clerk` and subscribe
   to the three events above.
3. Copy the endpoint's Signing Secret into `CLERK_WEBHOOK_SIGNING_SECRET` in
   `apps/api/.env` and restart the API.

The API verifies each delivery with Clerk's `verifyWebhook()`
([reference](https://clerk.com/docs/reference/backend/verify-webhook)) and
answers 400 to a request that is not signed with that secret.

## 7. Billing (optional)

Without the Stripe variables the app runs with billing switched off: the
Billing page says so, and the one gated feature (exporting notes) stays
locked. To switch it on, follow [STRIPE.md](STRIPE.md).

## 8. Tests

```bash
pnpm test       # unit tests; no keys, no database
pnpm test:int   # API integration tests
```

The integration tests read `DATABASE_URL_TEST` from the shell, not from
`apps/api/.env`. They truncate that database, so it must not be the
development one. Apply the migration to `app_test` once, then run them:

```bash
export DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5442/app_test"
DATABASE_URL="$DATABASE_URL_TEST" DIRECT_URL="$DATABASE_URL_TEST" pnpm --filter @app/api db:migrate:deploy
pnpm test:int
```

Without `DATABASE_URL_TEST` the database-backed tests are skipped, not failed.
Check that the summary reports no skipped tests.

There is no browser test suite. The web app's tests are unit tests that
answer the API with a mock; nothing in this repository signs in to Clerk.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:
install with a frozen lockfile, build, type-check, lint, unit tests, then the
API integration tests against a Postgres 16 service. It needs no secrets.
