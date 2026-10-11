# Deploying to Railway

To publish the starter as a Railway template, see
[RAILWAY-TEMPLATE.md](RAILWAY-TEMPLATE.md). This document is about running
your own project from the definition in `.railway/railway.ts`.

The starter includes a Railway definition, `.railway/railway.ts`, and a GitHub
workflow that plans and applies it.

**None of this has been run from this repository.** The definition
type-checks against the `railway` package, and it was cut down from one that
runs a larger application on the same stack, with the project-specific values
replaced by placeholders. No `railway` command has been run against it.
Statements below that are marked "authors' experience" come from that earlier
deployment and were not re-checked against Railway's documentation. Read the
plan Railway prints before you apply it.

You can deploy anywhere that runs two containers and a Postgres. The
Dockerfiles do not depend on Railway.

## What the definition describes

One Railway environment, `production`, deploying the `main` branch:

| Resource | Built from | Address |
|---|---|---|
| `web` | `apps/web/Dockerfile` | `app.example.com` |
| `api` | `apps/api/Dockerfile` | `api.example.com` |
| `Postgres` | Railway's Postgres | private network only |

What the file encodes:

- **Both images build from the repository root.** The Dockerfiles copy the
  workspace packages and the root lockfile, so neither service sets a root
  directory.
- **No secret is in the file.** Secrets are written as `preserve()`, which
  keeps the value already set on Railway. That includes the Clerk publishable
  key: it is public, but it belongs to your Clerk instance.
- **Migrations run before the new API goes live**, as a pre-deploy command.
  If a pre-deploy command fails, Railway does not proceed with the deployment
  ([Railway: Pre-deploy command](https://docs.railway.com/guides/pre-deploy-command)).
  `apps/api/scripts/migrate-deploy.mjs` retries `prisma migrate deploy` while
  the database is still starting.
- **`TRUST_PROXY` is `1`.** The API is behind Railway's proxy, and its rate
  limits key on the client address. With the wrong value every request appears
  to come from the proxy.
- **Watch paths** keep a push from rebuilding a service it did not touch.
- **The database never sleeps.** Authors' experience: a sleeping Postgres is
  not woken by a private-network connection, so an API starting against it
  fails.
- **A deploy waits for CI** (`WAIT_FOR_CI`), using the checks from
  `.github/workflows/ci.yml`.

## Railway does not read the file on deploy

A push builds and deploys the code with whatever settings were last applied.
The file changes Railway only through:

```bash
railway config plan    # preview
railway config apply   # apply
```

## First-time setup

1. **Edit the block marked `CHANGE THESE`** at the top of
   `.railway/railway.ts`: project name, repository, region, domains, app name
   and support email. Remove the `preserve()` lines for services you do not
   use (Stripe, Logtail).

2. **Create the project and link it.** Create an empty Railway project with
   the name you set, connect your GitHub repository to it, then:

   ```bash
   railway link
   railway config plan
   railway config apply
   ```

   Expect the plan to add `web`, `api` and `Postgres`.

3. **Set the secrets** on Railway, in the dashboard or with
   `railway variables --set`:

   | Service | Variables |
   |---|---|
   | `api` | `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` |
   | `api`, after step 5 | `CLERK_WEBHOOK_SIGNING_SECRET` |
   | `api`, optional | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_ID` (all three or none), `BILLING_PLAN_NAME`, `LOGTAIL_SOURCE_TOKEN`, `LOGTAIL_INGESTING_HOST` |
   | `web` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |

   The API's start-up checks are described in [SETUP.md](SETUP.md). We have
   not confirmed how `preserve()` behaves for a variable that does not exist
   on Railway yet. If the first plan objects, set the secrets before applying.

   `NEXT_PUBLIC_*` values are fixed into the browser bundle when the image is
   built. After changing one, redeploy the `web` service so it rebuilds.

4. **Domains.** Authors' experience: the file can list a custom domain but
   does not register a new one. For each host:

   ```bash
   railway domain app.example.com --service web
   ```

   Railway gives you a CNAME and a TXT record to create at your DNS provider.
   Both are required
   ([Railway: Public networking](https://docs.railway.com/guides/public-networking)).
   When both domains resolve, set `DOMAINS_REGISTERED` to `true` and apply.

5. **Webhooks.** Point Clerk and Stripe at the API's webhook addresses. The
   paths, the events to subscribe to and where each signing secret goes are in
   [SETUP.md](SETUP.md) and [STRIPE.md](STRIPE.md).

6. **Let the workflow apply changes.** In GitHub, under Settings,
   Environments, create `production`. In Railway, create a project token for
   the production environment and store it as a secret named `RAILWAY_TOKEN`
   on that GitHub environment. To require approval before changes are applied,
   add a required reviewer to the environment.

## The workflow

`.github/workflows/railway-config.yml` runs only on pull requests that change
`.railway/**`:

- When the pull request is opened or updated, it runs `railway config plan`
  and posts the plan as a comment.
- When the pull request merges, it runs `railway config apply --yes`. It does
  not pass `--confirm-destructive`, so deleting a service, volume or variable
  stops the apply and has to be done by a person.

The workflow pins the Railway CLI to 5.62.1. Authors' experience: 5.64.2
rejected `railway config plan` with a project token. Re-test before raising
it.

Until the `RAILWAY_TOKEN` secret exists, the workflow fails on pull requests
that touch `.railway/`. Delete the workflow if you do not deploy to Railway.

## Day to day

- **Change a setting:** edit `railway.ts`, open a pull request, read the plan
  comment, merge.
- **Add a variable:** add its name to `railway.ts` (as `preserve()` if it is a
  secret) and set the value on Railway. Authors' experience: a variable that
  exists on Railway but is not named in the file appears in the plan as a
  deletion, which the workflow will not apply.
- **Roll back a deploy:** in the Railway dashboard, redeploy the last good
  deployment. **Roll back a setting:** revert the pull request.
- **A second environment:** this starter describes one. To add staging, give
  the definition a second branch and set of domains keyed on the environment
  name, and create the environment in Railway.

## Ports and health checks

| Service | Port | Health check |
|---|---|---|
| `web` | 3000 | `GET /api/health` |
| `api` | 4000 | `GET /api/v1/health` |

The ports are set as `PORT` in `railway.ts` and match the Dockerfiles. Neither
health check goes through Clerk, so a missing or rotated Clerk key does not
fail a deploy's health check for a reason unrelated to whether the process is
up.
