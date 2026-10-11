# Solo starter

A starting point for a web application with one user per account. A person
signs up, signs in, uses the app, and can pay for one subscription.

It is two applications and two shared packages in one pnpm workspace:

| Path | Package | What it is |
|---|---|---|
| `apps/web` | `@app/web` | The web client. Next.js App Router, on port 3000. |
| `apps/api` | `@app/api` | The API. Express, Prisma and Postgres, on port 4000. |
| `packages/ui` | `@app/ui` | Components and the layout shell the web client uses. |
| `packages/backend` | `@app/backend` | What the API boots from: auth, provisioning, error handling, logging. |

Sign-in and account management are [Clerk](https://clerk.com)'s own
components. The subscription is [Stripe](https://stripe.com) Checkout and the
Stripe customer portal. Stripe is optional: without Stripe values the app runs
with billing switched off.

| | |
|---|---|
| ![Home, the notes example](docs/screenshots/home.png) | ![Billing](docs/screenshots/billing.png) |

Try it without installing anything: the [live demo](https://solo-production-442c.up.railway.app)
runs on sample data in your browser, with no sign-up.

The pictures in `docs/screenshots/` were rendered without a Clerk account.
See [How the screenshots were made](#how-the-screenshots-were-made).

## What is included

- **Sign-in and accounts, by Clerk.** `<SignIn />` and `<SignUp />` on the
  app's own `/sign-in` and `/sign-up` routes, `<UserButton />` in the header,
  and `<UserProfile />` as the Account page. Whatever sign-in methods you
  switch on in Clerk appear without a code change.
- **A sidebar layout** with three entries: Home, Billing and Account. Light
  theme. It works at phone width.
- **One example table, notes**, owned by the signed-in user: list, create,
  edit, delete. It is the pattern to copy: the owner filter is in the query,
  input is parsed with Zod at the boundary, errors are typed, deletes are soft,
  and the tests walk every route as a signed-out visitor, as the owner and as
  another user.
- **Billing for one plan, per user.** Stripe Checkout to subscribe, the Stripe
  customer portal to manage or cancel, and a webhook that records whether the
  user is subscribed. It ignores duplicate deliveries and is unaffected by
  events arriving out of order.
- **One helper, `isSubscribed`, and one gated example.** Exporting notes as
  CSV needs a subscription: the API route is behind `requireSubscription`,
  and the web client shows the button locked with a link to Billing.
- **An API on Postgres** with environment validation at start, rate limits,
  request ids on every log line, one response envelope, and a route inventory
  test that fails when a route is added without declaring who may call it.
- **A card for the paid application kit**, at the foot of the sidebar, and
  a comparison page at `/upgrade`. It is promotion, and your own customers
  would see it: [remove it](#first-remove-the-upgrade-card) before you ship.
- **Deployment files**: a Dockerfile per app, health checks, a migration step
  that runs before the API goes live, a Railway definition for one
  environment, and a CI workflow that needs no secrets.

## What it is not

- **Not multi-tenant.** There are no organizations, teams, members,
  invitations or roles. Every row belongs to one user.
- **Not a pricing page.** One plan, one price. No plan comparison, no seats,
  no trials of its own.
- **No custom account screens.** Profile, password, connected accounts and
  account deletion are Clerk's components.
- **No dashboard, charts or analytics, no activity feed or notifications, no
  email sending, no demo mode.** The app cannot be tried without a Clerk
  application.
- **Not yet run against real services.** See
  [What has been verified](#what-has-been-verified).

## Moving up to the application kit

This starter is the single-user subset of the
[application kit](https://www.startupquickstart.com/kits/application-kit), a
paid product on the same stack and the same package versions. The kit adds
organizations with members, invitations and roles, per-organization billing
with several plans, a dashboard and analytics with a chart system, an
activity feed, an AI assistant, a component gallery and a public demo mode.
Because the versions and the API style are the same, moving up is adding
features, not migrating.

There are also free [guides](https://www.startupquickstart.com/guides).

## What you need

- Node.js 24 and pnpm 10
- Docker, for the local Postgres
- A Clerk application (the free development instance is enough)
- Optional: a Stripe sandbox, for billing

## First: remove the upgrade card

The sidebar carries a card that points at the paid application kit
("Building for teams?"), with a comparison page at `/upgrade`. It is there
for you, the developer who downloaded this. If you ship the app unchanged,
your customers see it too. It makes no network request and tracks nothing.

To switch it off, set one variable when you build the web app:

```bash
NEXT_PUBLIC_SHOW_KIT_CARD=0
```

Put it in `apps/web/.env.local` for development, and on your host as a build
variable (it is an `ARG` in `apps/web/Dockerfile`). Off, there is no card in
any form and `/upgrade` answers 404. Unset, empty or `1` means on; any other
value fails the build and names the variable.

To delete it for good (paths under `apps/web`):

1. Delete `src/features/kit-upgrade/`, `src/app/(app)/upgrade/` and
   `public/kit/`.
2. Remove what each `KIT CARD:` comment names, and the comment with it:
   - `next.config.ts`, three places: the import; the block of constants,
     from its comment down to and including `NOWHERE`; and the whole
     `rewrites` entry.
   - `src/config/app.config.ts`, five places: the import; the variable in
     the schema; the `showKitCard` setting in the type, with its comment;
     `showKitCard` in the object; and the `process.env` read.
   - `src/app/(app)/layout.tsx`, two places: the import and the
     `sidebarFooter` prop.
   - `src/__tests__/route-protection.test.ts`: the `/upgrade` line.
3. Remove the `NEXT_PUBLIC_SHOW_KIT_CARD` block from `.env.example` (its
   heading, the comment and the variable) and the marked `ARG`, with its
   comment, from `Dockerfile`. If you set the variable in
   `apps/web/.env.local` or on your host, remove it there too: nothing reads
   it any more.
4. Check, from the repository root. The first command prints nothing, and
   the second passes:

   ```bash
   grep -rn "KIT CARD:" apps --exclude-dir=node_modules --exclude-dir=.next
   pnpm build && pnpm type-check && pnpm lint && pnpm test
   ```

The `sidebarFooter` slot of the layout in `packages/ui` is generic and can
stay. Two things outside `apps/web` still mention the card, and nothing
checks them: the `NEXT_PUBLIC_SHOW_KIT_CARD` row in
`docs/RAILWAY-TEMPLATE.md`, and this README. `docs/screenshots/upgrade.png`
is only a picture for this README.

## Run it

In order. [docs/SETUP.md](docs/SETUP.md) has each step in full.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env          # then add the two Clerk keys
cp apps/web/.env.example apps/web/.env.local    # then add the same two keys
pnpm db:up
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>, sign up, and you are on Home with an empty list
of notes. For billing, follow [docs/STRIPE.md](docs/STRIPE.md): create one
product and one recurring price in Stripe, and set three variables.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Both apps, with reload |
| `pnpm build` | Build everything |
| `pnpm type-check`, `pnpm lint` | Static checks |
| `pnpm test` | Unit tests; no keys, no database |
| `pnpm test:int` | API integration tests, against `DATABASE_URL_TEST` |
| `pnpm db:up`, `pnpm db:down` | Start and stop the local Postgres |
| `pnpm db:migrate` | Apply migrations |

## Documents

| Document | What it covers |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Getting it running, step by step, and the Clerk documentation the code follows |
| [docs/STRIPE.md](docs/STRIPE.md) | The one product and price, the webhook, the subscription rule, gating a feature |
| [docs/RAILWAY.md](docs/RAILWAY.md) | Deploying your own project to Railway from `.railway/railway.ts` |
| [docs/RAILWAY-TEMPLATE.md](docs/RAILWAY-TEMPLATE.md) | The exact settings for a Railway template |
| [docs/MANUAL-TESTING.md](docs/MANUAL-TESTING.md) | A checklist to run against your own Clerk and Stripe, with what has been run here |
| [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md) | Licences of the two typefaces the app ships |

## How it is put together

**Who is the user.** The browser gets a session token from Clerk and sends it
to the API as a bearer token. The API verifies it with Clerk, finds or
creates the user's row, and every handler reads the user from there, never
from the request body.

**How a request is authorized.** `apps/api/src/api/v1/index.ts` mounts routes
in a fixed order: the health check and the two signed webhooks, then the
session check, then features. Everything after the session check needs a
signed-in user, and each feature works only on that user's rows. The owner
filter is part of the query (`where: { id, userId, deletedAt: null }`), so a
row that belongs to someone else is simply not found: the API answers `404`,
not `403`, and never says whether it exists.

**The web client** protects pages twice, as Clerk's documentation describes:
`apps/web/src/proxy.ts` sends a signed-out visitor to `/sign-in` from every
path that is not listed as public, and each protected page also calls
`auth.protect()`. A test fails when a page is added that is neither protected
nor listed as public. Data is fetched with TanStack Query; the cache is tied
to the signed-in user and starts empty when someone else signs in.

**Billing.** The Stripe webhook is the only writer of subscription state. See
[docs/STRIPE.md](docs/STRIPE.md).

## Adding your own table

Copy the example. Each piece is small, and the comments in it say why it is
the way it is:

1. `apps/api/prisma/models/note.prisma`: the model, with the owner column and
   `deletedAt`. Add yours in a file of its own beside it, with its own table
   name in `@@map` and its own prefix in the id (`app.nanoid('task_'::text)`
   for a table of tasks), and add the relation on `user.prisma`. Then, with
   Postgres running and `apps/api/.env` pointing at it, create the migration
   and apply it to your development database:

   ```bash
   pnpm --filter @app/api db:migrate --name add_tasks
   pnpm --filter @app/api db:generate
   ```

   Without `--name` the first command stops to ask for one. It does not
   regenerate the Prisma client; the second command does, and so do
   `pnpm build`, `pnpm type-check` and `pnpm test`.
2. `apps/api/src/api/v1/notes/`: schemas (Zod), model (every query filtered
   by owner), controller, routes. Mount your router in
   `apps/api/src/api/v1/index.ts`, after the session check, where notes is
   mounted.
3. `apps/api/src/api/v1/webhooks/clerk/clerk-sync.service.ts`: a deleted user
   takes their rows with them. Add your table to the transaction, next to the
   line that does it for notes. No test fails if you leave this out.
4. `apps/api/tests/integration/notes.integration.test.ts`: every route as a
   signed-out visitor, the owner and another user. Add your routes to
   `route-inventory.test.ts`, which fails until you do, and your table to
   `truncateAll` in `tests/integration/helpers/seed.ts`. The test database
   needs the new migration before `pnpm test:int`: apply it with the
   `db:migrate:deploy` line in [docs/SETUP.md](docs/SETUP.md), section 8.
5. `apps/web/src/features/notes/`: the Zod model of the responses, the query
   hooks, the list screen and the form dialog, with their tests. A screen of
   your own needs a page under `apps/web/src/app/(app)/` that calls
   `auth.protect()`, an entry in `src/config/navigation.tsx`, and a line in
   `src/__tests__/route-protection.test.ts`, which fails until the page is
   listed.

To put a route behind the subscription, add `requireSubscription` in front of
it ([docs/STRIPE.md](docs/STRIPE.md#gating-a-feature)).

## Removing the example table

Do this after your own first table exists, not before: several shared tests
use notes as their sample of "a protected feature" and "a gated route", and
they need something to point at. Every line of code that belongs to the
example is marked:

```bash
grep -rn "EXAMPLE: notes" apps --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=generated
```

A marker sits on the line above what it names. Wherever a step below has you
replace a marked line and keep the file, delete the marker comment too: the
last check is that the search above finds nothing.

API (paths under `apps/api`):

1. Delete `src/api/v1/notes/` and `tests/integration/notes.integration.test.ts`.
2. In `src/api/v1/index.ts`, remove the marked import, and the marked line
   that mounts the router together with the comment line above its marker
   ("The example feature, and the pattern to copy.").
3. In `src/api/v1/webhooks/clerk/clerk-sync.service.ts`, the marked line
   soft-deletes a deleted user's notes with them. Replace `prisma.note` in it
   with your own model, or remove the line if your table is already in that
   transaction.
4. Delete `prisma/models/note.prisma` and the marked relation in
   `prisma/models/user.prisma`, then create a migration that drops the table
   and regenerate the client. In a terminal:

   ```bash
   pnpm --filter @app/api db:migrate --name drop_notes
   pnpm --filter @app/api db:generate
   ```

   If your development database has notes in it, the first command warns
   that the table is not empty and asks you to confirm. Where there is no
   terminal to answer in (a script, an agent), it refuses instead. Write the
   migration without it, in a new folder named like the others with the
   current time, so that it sorts last:

   ```bash
   mkdir apps/api/prisma/migrations/20270101000000_drop_notes
   pnpm --filter @app/api exec prisma migrate diff --from-config-datasource --to-schema prisma \
     --script --output prisma/migrations/20270101000000_drop_notes/migration.sql
   pnpm --filter @app/api db:migrate:deploy
   pnpm --filter @app/api db:generate
   ```

   Either way the new `migration.sql` holds two statements: it drops the
   foreign key `notes_user_id_fkey`, then the table `app.notes`. Do not edit
   the first migration if it has been applied anywhere you care about.
5. In the tests, each marker says what to put in its place:
   - `tests/integration/route-inventory.test.ts`: remove the six entries,
     with the marker and the two comment lines among them.
   - `tests/integration/helpers/seed.ts`: in `truncateAll`, put your table
     where `app.notes` is, or remove that line if yours is already listed.
   - `tests/integration/clerk-auth.test.ts`, three markers: the `NOTES`
     constant (the path of your feature), three rows in the table of methods
     and paths (your routes), and the request that creates a row (the body
     your create route takes). The table passes whatever it names, because
     every path under `/api/v1` answers 401 without a session, so check its
     rows by eye.
   - `tests/integration/billing.integration.test.ts`: the `EXPORT` constant.
     Point it at a `GET` route of yours behind `requireSubscription` that
     answers 200 to a subscriber.
   - `tests/integration/account-deletion.integration.test.ts`, five markers:
     the `liveNotes` counter, the rows created before each test, the read of
     the deleted rows, the list route and the gated route.
   - `src/lib/database/prisma-client.test.ts`, two markers: `client.note`
     becomes a model of yours.

Web (paths under `apps/web`):

6. Delete `src/features/notes/`.
7. In `src/app/(app)/page.tsx`, replace the marked import and the marked view
   with your own Home.
8. In `src/config/navigation.tsx` and `src/__tests__/route-protection.test.ts`
   the marked line is Home's entry. While Home stays at `/` there is nothing
   to change in either: delete the two marker comments.
9. In `src/components/pages/BillingView.tsx`, the marked line lists what the
   plan unlocks ("Export your notes as a CSV file"): say what yours unlocks.

Then prove nothing was missed, from the repository root. Give the
integration tests a database that has every migration: `db:migrate:deploy`
brings the test database of [docs/SETUP.md](docs/SETUP.md), section 8, up to
date, or builds an empty one from nothing. Every command passes, the
integration tests report none skipped, and the search prints nothing:

```bash
pnpm build && pnpm type-check && pnpm lint && pnpm test
export DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5442/app_test"
DATABASE_URL="$DATABASE_URL_TEST" DIRECT_URL="$DATABASE_URL_TEST" pnpm --filter @app/api db:migrate:deploy
pnpm test:int
grep -rn "EXAMPLE: notes" apps --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=generated
```

What is left is prose, which nothing checks. These still describe notes:
`docs/STRIPE.md` ("Gating a feature" and "When an account is deleted"),
`docs/SETUP.md`, `docs/MANUAL-TESTING.md` (part C, and the steps that call
`/api/v1/notes`), `apps/api/prisma/README.md`, the Stripe comment in
`apps/api/.env.example`, and this README. So do a few comments and test
names in files you kept: the top of `apps/api/prisma/seed.ts`,
`clerk-sync.service.ts`, `tests/integration/route-inventory.test.ts` and
`tests/integration/account-deletion.integration.test.ts`. If you kept the
upgrade page, the "Dashboard" and "The example to copy" rows of
`apps/web/src/features/kit-upgrade/kit-content.ts` describe notes too.

## What has been verified

Run in this repository, with no Clerk or Stripe keys:

- Install with a frozen lockfile, build, type-check and lint of all four
  packages.
- The unit tests of all four packages.
- The API integration tests, against a Postgres 15 started without Docker, on
  a database migrated from nothing.
- The build steps of both Dockerfiles, replayed on a workstation without
  Docker, in a clean copy with the ignore file applied.
- Both removal sections of this README, followed as written in throwaway
  copies: the upgrade card (switched off, and deleted), and the example table
  (after adding a small table by "Adding your own table"), and both together.
  After each, the build, type-check, lint, unit tests and integration tests
  passed. Two things were not exercised: Prisma's interactive confirmation
  when dropping a table that still has rows, and a second web page with its
  own navigation entry.

Not run:

- **Anything against a real Clerk application.** No one has signed in to this
  app. Clerk's components have not been rendered here; the code follows
  Clerk's documentation (cited in [docs/SETUP.md](docs/SETUP.md)) and
  type-checks against the installed SDK.
- **Anything against a real Stripe account.** Billing is tested with an
  in-memory stand-in for Stripe.
- **The two apps talking to each other.** The web tests answer the API with a
  mock written from the API's contract; the API tests call it directly.
- **Docker images, Postgres 16, Railway, and the CI workflow on GitHub.**

[docs/MANUAL-TESTING.md](docs/MANUAL-TESTING.md) is the list to run before
you rely on it.

## How the screenshots were made

No Clerk account was used. The pictures come from the public demo of this
starter, which runs these screens on sample data with stand-ins where Clerk's
components appear (the account control in the header, and the profile on the
Account page). So they show the layout, the notes screen, the billing screen
and the upgrade page as the code draws them; they do not show sign-in or
Clerk's own components. You can open the demo yourself:
<https://solo-production-442c.up.railway.app>.

## Versions

The same versions as the application kit, so code moves between the two
without a version change. The ranges are in each `package.json`; the lockfile
pins what was tested.

| | |
|---|---|
| Node.js | 24 |
| pnpm | 10.30.3 |
| TypeScript | ^6.0.3 |
| Next.js | ^16.4.0 |
| React | ^19.3.0 |
| `@clerk/nextjs` | ^7.9.14 |
| `@clerk/express` | ^2.1.78 |
| Express | ^5.3.0 |
| Prisma | ^7.10.0 |
| `stripe` | ^23.0.0 |
| Zod | ^4.6.5 |
| TanStack Query | ^5.104.1 |
| Tailwind CSS | ^4.3.3 |
| Vitest | ^5.0.3 |

## Licence

MIT. See [LICENSE](LICENSE). The two typefaces the app ships have their own
licence: [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
