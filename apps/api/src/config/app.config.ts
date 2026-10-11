import type { AppConfig as BackendAppConfig } from '@app/backend';
import { AppConfigService, createDefaultAppConfig } from '@app/backend';
import { z } from 'zod';

/**
 * The one place the API's product identity and environment live.
 *
 * `loadApiConfig()` parses `process.env` once, at boot, into a frozen typed
 * object. A missing or malformed variable stops the process with a message
 * naming it, instead of surfacing as `undefined` inside a request handler.
 * Everything downstream receives the parsed config as an argument.
 */

export const NODE_ENV = {
  development: 'development',
  test: 'test',
  production: 'production',
} as const;

export type NodeEnv = (typeof NODE_ENV)[keyof typeof NODE_ENV];

const DEFAULT_APP_NAME = 'Your App';
const DEFAULT_PORT = 4000;
const DEFAULT_HOST = 'localhost';
const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5442/app';
const DEFAULT_DATABASE_MAX_CONNECTIONS = 10;
/** No proxy in front of the process: `req.ip` is the socket address. */
const DEFAULT_TRUST_PROXY_HOPS = 0;
const WILDCARD_ORIGIN = '*';
/** What the one plan is called on the billing page unless BILLING_PLAN_NAME says otherwise. */
export const DEFAULT_BILLING_PLAN_NAME = 'Pro';
const BILLING_PLAN_NAME_MAX = 60;
/** Every Stripe price id starts with this; a product id or a lookup key pasted by mistake does not. */
const STRIPE_PRICE_ID_PREFIX = 'price_';

/** An unset variable and an empty one mean the same thing. */
const blankAsUnset = (value: unknown): unknown => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const optionalString = z.preprocess(blankAsUnset, z.string().optional());

/** An origin: scheme and host, optional port, nothing after it. */
const originSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).origin === value.replace(/\/$/, ''), 'must be an origin such as https://app.example.com')
  .transform((value) => value.replace(/\/$/, ''));

const envSchema = z.object({
  NODE_ENV: z.preprocess(blankAsUnset, z.enum(NODE_ENV).default(NODE_ENV.development)),
  PORT: z.preprocess(blankAsUnset, z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT)),
  HOST: z.preprocess(blankAsUnset, z.string().default(DEFAULT_HOST)),
  APP_NAME: z.preprocess(blankAsUnset, z.string().min(1).default(DEFAULT_APP_NAME)),
  APP_URL: z.preprocess(blankAsUnset, originSchema.optional()),
  CORS_ORIGIN: optionalString,
  TRUST_PROXY: z.preprocess(blankAsUnset, z.coerce.number().int().min(0).default(DEFAULT_TRUST_PROXY_HOPS)),
  DATABASE_URL: optionalString,
  DATABASE_MAX_CONNECTIONS: z.preprocess(
    blankAsUnset,
    z.coerce.number().int().min(1).default(DEFAULT_DATABASE_MAX_CONNECTIONS),
  ),
  CLERK_SECRET_KEY: optionalString,
  CLERK_PUBLISHABLE_KEY: optionalString,
  CLERK_WEBHOOK_SIGNING_SECRET: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_ID: z.preprocess(
    blankAsUnset,
    z
      .string()
      .trim()
      .startsWith(STRIPE_PRICE_ID_PREFIX, `must be a Stripe price id (it starts with "${STRIPE_PRICE_ID_PREFIX}")`)
      .optional(),
  ),
  BILLING_PLAN_NAME: z.preprocess(
    blankAsUnset,
    z.string().trim().min(1).max(BILLING_PLAN_NAME_MAX).default(DEFAULT_BILLING_PLAN_NAME),
  ),
});

/** Everything billing needs from Stripe. Present as a whole or not at all. */
export interface StripeConfig {
  readonly secretKey: string;
  readonly webhookSecret: string;
  /** The price of the one plan: what Checkout sells. */
  readonly priceId: string;
}

export interface ApiConfig {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  /** Product name, used in logs and the health response. */
  readonly appName: string;
  readonly port: number;
  readonly host: string;
  /**
   * Origin of the web client. Stripe Checkout and the customer portal return
   * the customer here, so it is never taken from a request.
   */
  readonly appUrl: string;
  /** Origins allowed by CORS. Always explicit: the API sends credentials. */
  readonly corsOrigins: readonly string[];
  /**
   * Reverse-proxy hops in front of the process (Express `trust proxy`).
   * 0 trusts nothing; 1 trusts the platform's load balancer. With the wrong
   * value `req.ip` is either the proxy's address (every client shares one
   * rate-limit bucket) or a value the client can forge.
   */
  readonly trustProxyHops: number;
  readonly database: {
    readonly url: string;
    readonly maxConnections: number;
  };
  readonly clerk: {
    readonly secretKey: string | undefined;
    readonly publishableKey: string | undefined;
    readonly webhookSigningSecret: string | undefined;
  };
  /** `undefined`: billing is off. The API runs, nobody is subscribed and the gated feature stays locked. */
  readonly stripe: StripeConfig | undefined;
  /** The display name of the one plan. */
  readonly billingPlanName: string;
}

type EnvSource = Readonly<Record<string, string | undefined>>;

function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Parse and validate the API's environment.
 *
 * In production the variables a real deployment cannot run without are
 * required. In development and test they fall back to the local defaults so a
 * fresh clone starts with only the Clerk keys filled in.
 *
 * @param source - The environment to read; `process.env` at the composition root.
 * @returns The frozen configuration.
 * @throws Error listing every invalid or missing variable.
 */
export function parseApiConfig(source: EnvSource): ApiConfig {
  const parsed = envSchema.safeParse(source);
  const problems: string[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  if (!parsed.success) throw new Error(`Invalid API configuration. ${problems.join('; ')}`);

  const env = parsed.data;
  const isProduction = env.NODE_ENV === NODE_ENV.production;
  const appUrl = env.APP_URL ?? DEFAULT_APP_URL;
  const corsOrigins = env.CORS_ORIGIN ? parseOrigins(env.CORS_ORIGIN) : [appUrl];

  if (corsOrigins.includes(WILDCARD_ORIGIN)) {
    problems.push('CORS_ORIGIN: a wildcard is not allowed because the API sends credentials; list each origin');
  }
  for (const origin of corsOrigins) {
    if (origin !== WILDCARD_ORIGIN && !originSchema.safeParse(origin).success) {
      problems.push(`CORS_ORIGIN: "${origin}" is not an origin such as https://app.example.com`);
    }
  }
  if (isProduction) {
    if (!env.APP_URL) problems.push('APP_URL: required in production');
    if (!env.CORS_ORIGIN) problems.push('CORS_ORIGIN: required in production');
    if (!env.DATABASE_URL) problems.push('DATABASE_URL: required in production');
    if (!env.CLERK_SECRET_KEY) problems.push('CLERK_SECRET_KEY: required in production');
    // CLERK_WEBHOOK_SIGNING_SECRET is not required to start. It only exists
    // once the webhook endpoint has been created in Clerk, which needs this
    // API's public address, which on most hosts is known only after the first
    // deploy. Until it is set the endpoint refuses every delivery.
  }

  // Stripe is all or nothing. A key without the webhook secret would sell
  // subscriptions that are never recorded; both without a price would have
  // nothing to sell. STRIPE_PRICE_ID alone is harmless and is ignored.
  let stripe: StripeConfig | undefined;
  if (Boolean(env.STRIPE_SECRET_KEY) !== Boolean(env.STRIPE_WEBHOOK_SECRET)) {
    problems.push(
      'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET: set both or neither; the subscription is only recorded by the webhook',
    );
  } else if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    if (env.STRIPE_PRICE_ID) {
      stripe = Object.freeze({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        priceId: env.STRIPE_PRICE_ID,
      });
    } else {
      problems.push('STRIPE_PRICE_ID: required when the Stripe keys are set; it is the price Checkout sells');
    }
  }
  if (problems.length > 0) throw new Error(`Invalid API configuration. ${problems.join('; ')}`);

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction,
    appName: env.APP_NAME,
    port: env.PORT,
    host: env.HOST,
    appUrl,
    corsOrigins: Object.freeze(corsOrigins),
    trustProxyHops: env.TRUST_PROXY,
    database: Object.freeze({
      url: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
      maxConnections: env.DATABASE_MAX_CONNECTIONS,
    }),
    clerk: Object.freeze({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      webhookSigningSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    }),
    stripe,
    billingPlanName: env.BILLING_PLAN_NAME,
  });
}

/** Parse `process.env`. Call once, at the composition root. */
export function loadApiConfig(): ApiConfig {
  return parseApiConfig(process.env);
}

/** Global rate limit applied by the shared backend to every `/api` route. */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 1000;
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const API_VERSION = '1.0.0';

/**
 * Translate the API config into the shape `@app/backend` boots from.
 *
 * @param config - The parsed API configuration.
 * @returns The config service handed to `Backend.create`.
 */
export function createBackendConfigService(config: ApiConfig): AppConfigService {
  const backendConfig: BackendAppConfig = createDefaultAppConfig({
    app: {
      name: `${config.appName} API`,
      version: API_VERSION,
      description: `API for ${config.appName}`,
      environment: config.nodeEnv,
    },
    features: {
      // No media is stored; the block is required by @app/backend.
      media: { enabled: false, maxFileSize: 0, allowedTypes: [], storageProvider: 'local' },
      billing: { enabled: config.stripe !== undefined, provider: 'stripe', currency: 'usd' },
    },
    server: {
      port: config.port,
      host: config.host,
      cors: {
        origin: [...config.corsOrigins],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      },
      rateLimit: { windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX_REQUESTS },
    },
    auth: {
      provider: 'clerk',
      requireEmailVerification: true,
      enableMfa: false,
      sessionTimeout: SESSION_TIMEOUT_MS,
    },
    database: {
      url: config.database.url,
      maxConnections: config.database.maxConnections,
      ssl: config.isProduction,
    },
  });
  return new AppConfigService(backendConfig);
}
