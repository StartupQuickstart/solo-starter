// Railway infrastructure as code for this project: the web client, the API and
// their Postgres, in one environment.
//
// Railway does NOT read this file on deploy. Changes take effect only through
// `railway config plan` / `railway config apply` (or the "Railway config"
// GitHub workflow when a pull request merges). GitHub pushes still build and
// deploy the code with the settings last applied from here. See docs/RAILWAY.md.
//
// Local development does not use Railway: it runs against the Docker Postgres
// in apps/api/docker-compose.yml.
//
// Both apps build from the repository root: the Dockerfiles copy workspace
// packages and the root lockfile, so no service may set a root directory.
// Secret values live on Railway; `preserve()` keeps them out of git.
import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

// ─── CHANGE THESE ───────────────────────────────────────────────────────────
// Everything specific to your project is in this block. Nothing below it needs
// editing to get a first deploy.

/** The Railway project name, as shown in the Railway dashboard. */
const PROJECT_NAME = "CHANGE_ME";

/** The GitHub repository Railway deploys from, as `owner/name`. */
const REPO = "CHANGE_ME/CHANGE_ME";

/** A Railway region id. `railway config pull` on an existing project shows the ids in use. */
const REGION = "CHANGE_ME";

/** The branch that deploys. */
const BRANCH = "main";

/** The hosts the app answers on. `app` is the web client, `api` the API. */
const DOMAINS = { app: "app.example.com", api: "api.example.com" } as const;

/**
 * This file can list a custom domain but, as far as we have seen, not register
 * a new one: a domain is added once (`railway domain <host> --service <svc>`),
 * its DNS records are created at your DNS provider, and only then is it listed
 * here. Set this to true after both domains are registered. Until then the
 * services deploy without them.
 */
const DOMAINS_REGISTERED = false;

/** Shown in the web client and in API logs. */
const APP_NAME = "Your App";
const SUPPORT_EMAIL = "support@example.com";

/**
 * Make a deploy wait for the repository's GitHub checks (.github/workflows/ci.yml)
 * to pass. Turn it off if the repository has no CI workflow.
 */
const WAIT_FOR_CI = true;
// ─── END OF THE BLOCK TO CHANGE ─────────────────────────────────────────────

/** Workspace-root files every build depends on. */
const WORKSPACE_ROOT_FILES = ["/package.json", "/pnpm-lock.yaml", "/pnpm-workspace.yaml", "/turbo.json", "/.npmrc"];

/** The ports the containers listen on. They match the Dockerfiles. */
const WEB_PORT = "3000";
const API_PORT = "4000";

/** The API waits for the database before it listens, so its healthcheck allows 5 minutes. */
const HEALTHCHECK_TIMEOUT_SECONDS = 300;

/** The API sits behind Railway's proxy: one hop. Rate limits key on the address this yields. */
const PROXY_HOPS = "1";

const AUTH_PATHS = { signIn: "/sign-in", signUp: "/sign-up", home: "/" } as const;

export default defineRailway(() => {
  const customDomain = (host: string) => (DOMAINS_REGISTERED ? [host] : []);

  const repo = github(REPO, { branch: BRANCH, checkSuites: WAIT_FOR_CI });

  // The database never sleeps: a sleeping Postgres is not woken by
  // private-network connections, so an API waking against it cannot start.
  // The database brings its own volume (Railway names it; it is not declared here).
  const Postgres = postgres("Postgres", { region: REGION });
  Postgres.deploy = { sleepApplication: false };
  Postgres.networking = { privateNetworkEndpoint: "postgres" };

  const api = service("api", {
    source: repo,
    replicas: { [REGION]: 1 },
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/api/Dockerfile",
      watchPatterns: ["/apps/api/**", "/packages/backend/**", ...WORKSPACE_ROOT_FILES],
    },
    deploy: {
      startCommand: "node apps/api/dist/index.js",
      // Fail the deploy before it goes live if a migration breaks.
      preDeployCommand: ["pnpm --filter @app/api db:migrate:prod"],
      healthcheckPath: "/api/v1/health",
      healthcheckTimeout: HEALTHCHECK_TIMEOUT_SECONDS,
      sleepApplication: false,
    },
    domains: customDomain(DOMAINS.api),
    // Every name here is validated at boot by apps/api/src/config/app.config.ts.
    env: {
      NODE_ENV: "production",
      PORT: API_PORT,
      HOST: DOMAINS.api,
      APP_NAME,
      // Where Stripe returns the browser after Checkout and the customer portal.
      APP_URL: `https://${DOMAINS.app}`,
      CORS_ORIGIN: `https://${DOMAINS.app}`,
      TRUST_PROXY: PROXY_HOPS,
      DATABASE_URL: Postgres.env.DATABASE_URL,
      DIRECT_URL: Postgres.env.DATABASE_URL,
      // Set the two keys on Railway before the first deploy; the API refuses
      // to start without the secret key. The signing secret comes later, from
      // the webhook endpoint you create in Clerk once the API has its address.
      CLERK_PUBLISHABLE_KEY: preserve(),
      CLERK_SECRET_KEY: preserve(),
      CLERK_WEBHOOK_SIGNING_SECRET: preserve(),
      // Optional: billing. Set all three or none; without them billing is off
      // and the app still runs. Delete the four lines if you do not use Stripe.
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      STRIPE_PRICE_ID: preserve(),
      BILLING_PLAN_NAME: preserve(),
      // Optional: log shipping. Delete the two lines if you do not use it.
      LOGTAIL_SOURCE_TOKEN: preserve(),
      LOGTAIL_INGESTING_HOST: preserve(),
    },
  });

  // NEXT_PUBLIC_* values are inlined at build time: Railway passes service
  // variables to the Dockerfile's matching ARGs (apps/web/Dockerfile).
  const web = service("web", {
    source: repo,
    replicas: { [REGION]: 1 },
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/web/Dockerfile",
      watchPatterns: ["/apps/web/**", "/packages/ui/**", ...WORKSPACE_ROOT_FILES],
    },
    deploy: {
      startCommand: "node server.js",
      healthcheckPath: "/api/health",
      healthcheckTimeout: HEALTHCHECK_TIMEOUT_SECONDS,
      sleepApplication: false,
    },
    domains: customDomain(DOMAINS.app),
    env: {
      PORT: WEB_PORT,
      HOSTNAME: "0.0.0.0",
      NEXT_PUBLIC_APP_NAME: APP_NAME,
      NEXT_PUBLIC_SUPPORT_EMAIL: SUPPORT_EMAIL,
      NEXT_PUBLIC_API_URL: `https://${DOMAINS.api}`,
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: AUTH_PATHS.signIn,
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: AUTH_PATHS.signUp,
      // Where to land after signing in or up, when no other page was asked for.
      NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: AUTH_PATHS.home,
      NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: AUTH_PATHS.home,
      // Set these on Railway before the first deploy. The publishable key is
      // public by design, but it is your instance's, so it is not written here.
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: preserve(),
      CLERK_SECRET_KEY: preserve(),
    },
  });

  return project(PROJECT_NAME, { resources: [web, api, Postgres] });
});
