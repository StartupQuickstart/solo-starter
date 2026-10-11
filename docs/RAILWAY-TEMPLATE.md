# Railway template settings

The exact settings to create a Railway template from this repository: the web
client, the API and Postgres. The deployer supplies Clerk keys, and Stripe
values if they want billing.

Both images build from the Dockerfiles in this repository and are configured
with environment variables only. The template does not need a config file in
the repository.

**Status.** No Railway command has been run and nothing has been deployed
from this repository. The Railway statements below link to the page of
Railway's documentation they came from; they were checked on 2026-10-10 for
the larger application this starter was cut down from, and not again since.
Where the documentation does not say, this document says so. The build steps
of both Dockerfiles were replayed on a workstation without Docker (see "What
was checked" at the end); the Docker images themselves have not been built.

## How a template is made

Railway offers two ways
([Create a template](https://docs.railway.com/templates/create)):

1. **From scratch**, in the template composer: workspace settings, Templates,
   New Template; add each service, choose its source, set its variables and
   settings, then Create Template.
2. **From an existing project**: in the project's Settings, "Generate Template
   from Project", then confirm in the composer.

That page lists what the composer's Settings tab offers per service: root
directory, public networking, start command and healthcheck path. It does not
mention a pre-deploy command or a Dockerfile path. This document therefore
uses:

- the `RAILWAY_DOCKERFILE_PATH` service variable to choose the Dockerfile,
  which works wherever variables can be set
  ([Dockerfiles](https://docs.railway.com/guides/dockerfiles)), and
- for the API's migration, a pre-deploy command set in the service's settings
  ([Pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command)).
  If the composer does not offer that field, use route 2: deploy the project
  once, set the pre-deploy command on the `API` service, and generate the
  template from it. Check the generated template still shows the command
  before publishing. If it does not, use the start command given under "If
  the pre-deploy command cannot be carried" below.

Source: this GitHub repository, default branch. A branch other than `main` is
chosen by putting the full branch URL in the source field
([Create a template](https://docs.railway.com/templates/create)).

**Root directory: leave empty on every service.** Both Dockerfiles copy
workspace files from the repository root (`pnpm-lock.yaml`, `packages/...`),
so the build context must be the root. Setting a root directory breaks the
build.

## The three services

The names matter: the reference variables below use them.

### Service `Postgres`

Add Railway's PostgreSQL database service. It exposes `DATABASE_URL`, along
with `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE`
([PostgreSQL](https://docs.railway.com/guides/postgresql)). Keep its volume:
Railway's guidance is that a database in a template always has one
([Template best practices](https://docs.railway.com/templates/best-practices)).
Do not enable public access; the API reaches it over the private network.

That page does not state which Postgres version the service runs. The starter
is developed against Postgres 16; its integration tests were run in this
repository against Postgres 15.

### Service `API`

| Setting | Value |
|---|---|
| Source | this repository |
| Root directory | empty |
| Public networking | HTTP, with a generated domain |
| Healthcheck path | `/api/v1/health` |
| Start command | empty (the image's own: `node apps/api/dist/index.js`) |
| Pre-deploy command | `pnpm --filter @app/api db:migrate:prod` |
| Volume | none |

Variables:

| Variable | Value | Kind |
|---|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `apps/api/Dockerfile` | fixed |
| `NODE_ENV` | `production` | fixed |
| `PORT` | `4000` | fixed |
| `TRUST_PROXY` | `1` | fixed |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | reference variable |
| `DIRECT_URL` | `${{Postgres.DATABASE_URL}}` | reference variable |
| `APP_URL` | `https://${{Web.RAILWAY_PUBLIC_DOMAIN}}` | reference variable |
| `CORS_ORIGIN` | `https://${{Web.RAILWAY_PUBLIC_DOMAIN}}` | reference variable |
| `APP_NAME` | `Your App` | default the deployer may change |
| `CLERK_SECRET_KEY` | none | **the deployer supplies this** (Clerk Dashboard, API keys) |
| `CLERK_PUBLISHABLE_KEY` | none | **the deployer supplies this** (same place) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | empty | the deployer supplies this **after the first deploy**; optional at deploy time |
| `STRIPE_SECRET_KEY` | empty | optional; the deployer supplies it to turn billing on |
| `STRIPE_WEBHOOK_SECRET` | empty | optional; required whenever `STRIPE_SECRET_KEY` is set |
| `STRIPE_PRICE_ID` | empty | optional; required whenever `STRIPE_SECRET_KEY` is set |
| `BILLING_PLAN_NAME` | empty | optional; the plan's name as the billing page shows it |

Notes:

- Reference variables are written `${{ServiceName.VARIABLE}}`
  ([Variables](https://docs.railway.com/guides/variables)).
  `RAILWAY_PUBLIC_DOMAIN` is the service's public domain, without a scheme
  ([Variables reference](https://docs.railway.com/reference/variables)), so
  the scheme is written in front of it.
- The API uses the database's `DATABASE_URL`, which is the private
  connection. Railway's guidance is to connect services to databases over
  the private network
  ([Template best practices](https://docs.railway.com/templates/best-practices)).
  `APP_URL` and `CORS_ORIGIN` use the web client's public domain on purpose:
  they name the origin the browser is on.
- `TRUST_PROXY=1`: the API is behind Railway's proxy, and its rate limits key
  on the client address. That it is exactly one hop is the authors'
  experience from an earlier deployment on the same stack, not a statement in
  Railway's documentation.
- **Pre-deploy command.** It runs after the build and before the deploy, in a
  separate container that has the service's variables and the private
  network; if it fails the deployment does not proceed. Volumes are not
  mounted in it, and any tool it needs must be in the image
  ([Pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command)).
  The API image contains pnpm, the Prisma CLI, the migrations and
  `scripts/migrate-deploy.mjs`, which is all the command uses. The script
  retries while the database is still starting.
- **Template functions.** Railway's guidance is to generate secrets with
  template functions such as `${{secret(32)}}` rather than hardcode them
  ([Create a template](https://docs.railway.com/templates/create)). This
  starter has no secret of its own to generate: the database password is
  Railway's, and every other secret is issued by Clerk or Stripe. No variable
  uses a template function.
- **`CLERK_WEBHOOK_SIGNING_SECRET` cannot be known at deploy time.** Clerk
  issues it when the webhook endpoint is created, and the endpoint needs the
  API's address. The API starts without it and refuses webhook deliveries
  until it is set. Signing in still works: the API creates a user's row the
  first time they make a signed-in request.
- **Stripe.** Set the three variables together or none of them. With none,
  billing is off: the billing page says so and the gated example stays
  locked. With only some, the API refuses to start and says why.
- Give every variable a description in the composer, and for the optional
  ones say where the value comes from
  ([Template best practices](https://docs.railway.com/templates/best-practices)).
  The Kind column says what each description has to tell the deployer.

### Service `Web`

| Setting | Value |
|---|---|
| Source | this repository |
| Root directory | empty |
| Public networking | HTTP, with a generated domain |
| Healthcheck path | `/api/health` |
| Start command | empty (the image's own: `node server.js`) |
| Pre-deploy command | none |
| Volume | none |

Variables:

| Variable | Value | Kind |
|---|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `apps/web/Dockerfile` | fixed |
| `PORT` | `3000` | fixed |
| `NEXT_PUBLIC_API_URL` | `https://${{API.RAILWAY_PUBLIC_DOMAIN}}` | reference variable; read at build time |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `${{API.CLERK_PUBLISHABLE_KEY}}` | reference variable; read at build time |
| `CLERK_SECRET_KEY` | `${{API.CLERK_SECRET_KEY}}` | reference variable |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | fixed; read at build time |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | fixed; read at build time |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` | fixed; read at build time |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` | fixed; read at build time |
| `NEXT_PUBLIC_APP_NAME` | `${{API.APP_NAME}}` | reference variable; read at build time |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@example.com` | default the deployer may change; read at build time |
| `NEXT_PUBLIC_SHOW_KIT_CARD` | `0` | optional; read at build time. `0` removes the card for the paid application kit from the sidebar, and the `/upgrade` page. Leave it out to keep them. |

The two Clerk values are references to the `API` service's variables, so the
deployer enters each key once. Service variables reach a Dockerfile build
only when the Dockerfile declares them with `ARG`
([Dockerfiles](https://docs.railway.com/guides/dockerfiles));
`apps/web/Dockerfile` declares every `NEXT_PUBLIC_*` variable it uses. Each is
fixed into the browser bundle when the image is built: after changing one,
redeploy `Web` so it rebuilds. The browser calls the API directly, so
`NEXT_PUBLIC_API_URL` is the API's public domain, not its private one.

`PORT`: healthchecks use the port in `PORT`
([Healthchecks](https://docs.railway.com/deployments/healthchecks)). Setting
it removes any doubt about which port the domain and the healthcheck use.
Railway calls the healthcheck path when a deployment starts and waits, by
default up to 300 seconds, for a 2xx; it is not used for monitoring
afterwards (same page).

### What the deployer does after the first deploy

1. In the Clerk Dashboard, leave Organizations off. This starter is one user
   per account ([SETUP.md](SETUP.md)).
2. Create the Clerk webhook endpoint for the API, copy its signing secret into
   `CLERK_WEBHOOK_SIGNING_SECRET` on the `API` service, and redeploy it
   ([SETUP.md](SETUP.md)).
3. For billing: create the one product and price in Stripe, set the three
   Stripe variables, and create the Stripe webhook endpoint
   ([STRIPE.md](STRIPE.md)).

Put these three steps in the template's overview. Railway's suggested
structure for the overview is in
[Template best practices](https://docs.railway.com/templates/best-practices).

### If the pre-deploy command cannot be carried

Leave the pre-deploy command empty and set the `API` service's start command
to:

```
sh -c "pnpm --filter @app/api db:migrate:prod && node apps/api/dist/index.js"
```

The migration then runs each time the container starts, before the server
listens. `prisma migrate deploy` applies only pending migrations and takes a
lock, so this is safe with one replica. It is second best: a failed migration
shows up as a failed healthcheck instead of a stopped deployment.

## Presentation

From [Template best practices](https://docs.railway.com/templates/best-practices):

- Service names in capital case, short, no dashes: `Web`, `API`, `Postgres`.
- A square icon with a transparent background for the template and each
  service. `apps/web/src/app/icon.svg` is the starter's placeholder mark.
- The workspace name is shown as the template's author.

## What was checked, and how

| Claim | How it was checked |
|---|---|
| The web image's build steps work | Replayed outside Docker on a workstation, in a clean copy of the committed tree with the ignore file applied: `pnpm install --frozen-lockfile` with `node-linker=hoisted`, build `@app/ui`, `next build`. The standalone server is produced. |
| The API image's build and runner steps work | The same for `@app/backend` and `@app/api`, then a production-only install beside the built files, as the runner stage does. |

Not checked: building either image with Docker, anything on Linux, the
pre-deploy command or the healthchecks in a container, and anything on
Railway.
