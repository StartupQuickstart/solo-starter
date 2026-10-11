import 'dotenv/config';
import type { PrismaClient } from '../generated/prisma';
import { Backend } from '@app/backend';
import express from 'express';
import { createV1Router, PUBLIC_PATHS } from '@/api/v1/index';
import type { StripeBilling } from '@/api/v1/billing/billing.service';
import { createBackendConfigService, loadApiConfig, type ApiConfig } from '@/config/app.config';
import { createStripeBillingGateway, createStripeClient } from '@/lib/billing/stripe-gateway';
import { boundPrismaClient, createPrismaClient } from '@/lib/database/prisma-client';
import { configureApp } from '@/server/configure-app';
import { waitForDatabase } from '@/server/wait-for-database';
// Side-effect import: applies Express module augmentation for app.backend typing
import '@/types';

const app = express();

// A sleeping or restarting Postgres refuses connections for a few seconds;
// ~30s of retries covers a wake-up before startup gives up.
const DATABASE_CONNECT_ATTEMPTS = 10;
const DATABASE_CONNECT_DELAY_MS = 3000;

/** The most a webhook body may weigh. Both providers send far less. */
const WEBHOOK_BODY_LIMIT = '1mb';

/** The Stripe gateway and the price it sells, or `undefined` when Stripe is not configured (billing is then off). */
function createStripeBilling(config: ApiConfig): StripeBilling | undefined {
  if (!config.stripe) return undefined;
  const { secretKey, webhookSecret, priceId } = config.stripe;
  return { gateway: createStripeBillingGateway(createStripeClient(secretKey), webhookSecret), priceId };
}

/**
 * Boot the API server.
 *
 * Validates the environment first, so a bad variable stops the process before
 * anything listens. Then waits for the database (bounded retries) and fails
 * startup if it still can't connect: the process exits non-zero and the host
 * restarts it. Serving without a database would answer every route 404 until
 * something restarted it.
 */
async function start(): Promise<void> {
  const config = loadApiConfig();
  const configService = createBackendConfigService(config);
  configService.log();

  // Before any middleware: rate limiting and logging read req.ip.
  configureApp(app, config);

  // Webhook signature verification requires the exact raw bytes the sender
  // signed. Mount express.raw() at the webhook paths BEFORE Backend.create()
  // installs the global express.json() middleware, so the handlers receive
  // req.body as a Buffer rather than a parsed (and re-serialized) object.
  for (const path of Object.values(PUBLIC_PATHS)) {
    app.use(path, express.raw({ type: 'application/json', limit: WEBHOOK_BODY_LIMIT }));
  }

  // Probe with a throwaway client so a failed attempt leaves no half-built
  // Backend (middleware, services) behind to retry over.
  const probeClient = createPrismaClient(config.database);
  try {
    await waitForDatabase(
      async () => {
        await probeClient.$queryRaw`SELECT 1`;
      },
      { attempts: DATABASE_CONNECT_ATTEMPTS, delayMs: DATABASE_CONNECT_DELAY_MS, log: console.warn },
    );
  } finally {
    await probeClient.$disconnect();
  }

  // Connects Prisma and installs the shared middleware; a failure here ends
  // startup (see start().catch).
  const backend = await Backend.create<PrismaClient>(app, boundPrismaClient(config.database), { configService });

  // Composition root: every collaborator the routes use is built here and
  // passed down. Route code reads no environment variables.
  const prisma = backend.database.client;
  if (!prisma) throw new Error('The database client was not created.');
  app.use(
    createV1Router({
      prisma,
      requireAuth: backend.auth.requireAuth(),
      clerkWebhook: { signingSecret: config.clerk.webhookSigningSecret },
      billing: { stripe: createStripeBilling(config), planName: config.billingPlanName, appUrl: config.appUrl },
    }),
  );

  if (config.isProduction && !config.clerk.webhookSigningSecret) {
    console.warn(
      '[api] CLERK_WEBHOOK_SIGNING_SECRET is not set: the Clerk webhook refuses every delivery, so changes made in Clerk are not copied to the database. Create the endpoint in Clerk and set the secret.',
    );
  }

  backend.setupErrorHandling();
  app.listen(config.port, () => {
    console.log(`[api] ${config.appName} API listening on port ${config.port}`);
  });
}

start().catch((error) => {
  // Printed in full on purpose: a configuration error names the variable to fix.
  console.error('Unhandled error during startup:', error);
  process.exit(1);
});
