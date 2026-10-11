import { describe, expect, it } from 'vitest';

import { createBackendConfigService, NODE_ENV, parseApiConfig } from './app.config';

const PRODUCTION_ENV = {
  NODE_ENV: NODE_ENV.production,
  APP_URL: 'https://app.example.com',
  CORS_ORIGIN: 'https://app.example.com',
  DATABASE_URL: 'postgresql://user:pass@db.internal:5432/app',
  CLERK_SECRET_KEY: 'clerk-secret-placeholder',
  CLERK_WEBHOOK_SIGNING_SECRET: 'clerk-webhook-placeholder',
} as const;

const STRIPE_ENV = {
  STRIPE_SECRET_KEY: 'stripe-key-placeholder',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-placeholder',
  STRIPE_PRICE_ID: 'price_placeholder',
} as const;

describe('parseApiConfig', () => {
  it('starts from an empty environment with the local development defaults', () => {
    const config = parseApiConfig({});

    expect(config.nodeEnv).toBe(NODE_ENV.development);
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(4000);
    expect(config.appUrl).toBe('http://localhost:3000');
    expect(config.corsOrigins).toEqual(['http://localhost:3000']);
    expect(config.trustProxyHops).toBe(0);
    expect(config.stripe).toBeUndefined();
    expect(config.billingPlanName).toBe('Pro');
  });

  it('treats an empty variable the same as an unset one', () => {
    const config = parseApiConfig({ PORT: '', APP_NAME: '  ', STRIPE_SECRET_KEY: '', BILLING_PLAN_NAME: ' ' });

    expect(config.port).toBe(4000);
    expect(config.appName).toBe('Your App');
    expect(config.stripe).toBeUndefined();
    expect(config.billingPlanName).toBe('Pro');
  });

  it('splits a comma-separated origin list', () => {
    const config = parseApiConfig({ CORS_ORIGIN: 'https://app.example.com, https://admin.example.com' });

    expect(config.corsOrigins).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('refuses a wildcard origin because the API sends credentials', () => {
    expect(() => parseApiConfig({ CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN: a wildcard is not allowed/);
  });

  it('refuses an origin that carries a path', () => {
    expect(() => parseApiConfig({ CORS_ORIGIN: 'https://app.example.com/billing' })).toThrow(/is not an origin/);
    expect(() => parseApiConfig({ APP_URL: 'https://app.example.com/billing' })).toThrow(/APP_URL/);
  });

  it('drops a trailing slash from the app URL', () => {
    expect(parseApiConfig({ APP_URL: 'https://app.example.com/' }).appUrl).toBe('https://app.example.com');
  });

  it('accepts a complete production environment', () => {
    const config = parseApiConfig(PRODUCTION_ENV);

    expect(config.isProduction).toBe(true);
    expect(config.database.url).toBe(PRODUCTION_ENV.DATABASE_URL);
  });

  it('starts in production before the Clerk webhook exists, with the signing secret unset', () => {
    // The endpoint can only be created in Clerk once the API has an address,
    // so a first deploy has no secret yet. The webhook route refuses every
    // delivery until one is set (clerk.routes.test.ts).
    const env: Record<string, string> = { ...PRODUCTION_ENV };
    delete env['CLERK_WEBHOOK_SIGNING_SECRET'];

    expect(parseApiConfig(env).clerk.webhookSigningSecret).toBeUndefined();
  });

  it.each(['APP_URL', 'CORS_ORIGIN', 'DATABASE_URL', 'CLERK_SECRET_KEY'] as const)(
    'names %s when it is missing in production',
    (name) => {
      const env: Record<string, string> = { ...PRODUCTION_ENV };
      delete env[name];

      expect(() => parseApiConfig(env)).toThrow(new RegExp(`${name}: required in production`));
    },
  );

  it('reports every problem at once', () => {
    expect(() => parseApiConfig({ NODE_ENV: NODE_ENV.production })).toThrow(
      /APP_URL.*CORS_ORIGIN.*DATABASE_URL.*CLERK_SECRET_KEY/s,
    );
  });

  it('rejects a port that is not a number', () => {
    expect(() => parseApiConfig({ PORT: 'eighty' })).toThrow(/PORT/);
  });

  it('returns a frozen object', () => {
    const config = parseApiConfig(STRIPE_ENV);

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.stripe)).toBe(true);
  });
});

describe('parseApiConfig: billing', () => {
  it('turns billing on when both Stripe keys and the price are set', () => {
    expect(parseApiConfig(STRIPE_ENV).stripe).toEqual({
      secretKey: 'stripe-key-placeholder',
      webhookSecret: 'stripe-webhook-placeholder',
      priceId: 'price_placeholder',
    });
  });

  it('refuses a Stripe key without its webhook secret, and the reverse', () => {
    expect(() => parseApiConfig({ STRIPE_SECRET_KEY: 'stripe-key-placeholder' })).toThrow(/set both or neither/);
    expect(() => parseApiConfig({ STRIPE_WEBHOOK_SECRET: 'stripe-webhook-placeholder' })).toThrow(
      /set both or neither/,
    );
  });

  it('refuses Stripe keys with no price to sell', () => {
    const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = STRIPE_ENV;

    expect(() => parseApiConfig({ STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET })).toThrow(
      /STRIPE_PRICE_ID: required when the Stripe keys are set/,
    );
  });

  it.each(['prod_placeholder', 'pro_monthly', '900'])('refuses %s as a price id', (value) => {
    expect(() => parseApiConfig({ ...STRIPE_ENV, STRIPE_PRICE_ID: value })).toThrow(/STRIPE_PRICE_ID/);
  });

  it('leaves billing off when only the price is set', () => {
    expect(parseApiConfig({ STRIPE_PRICE_ID: 'price_placeholder' }).stripe).toBeUndefined();
  });

  it('reads the plan name', () => {
    expect(parseApiConfig({ BILLING_PLAN_NAME: ' Plus ' }).billingPlanName).toBe('Plus');
  });

  it('refuses a plan name too long to show', () => {
    expect(() => parseApiConfig({ BILLING_PLAN_NAME: 'x'.repeat(61) })).toThrow(/BILLING_PLAN_NAME/);
  });
});

describe('createBackendConfigService', () => {
  it('passes the explicit origin list to CORS and never a wildcard', () => {
    const service = createBackendConfigService(parseApiConfig({ CORS_ORIGIN: 'https://app.example.com' }));

    expect(service.getServerConfig().cors).toMatchObject({
      origin: ['https://app.example.com'],
      credentials: true,
    });
  });

  it('turns billing on only when Stripe is configured', () => {
    const off = createBackendConfigService(parseApiConfig({}));
    const on = createBackendConfigService(parseApiConfig(STRIPE_ENV));

    expect(off.getFeatureConfig('billing').enabled).toBe(false);
    expect(on.getFeatureConfig('billing').enabled).toBe(true);
  });
});
