import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { RATE_LIMITED_CODE, createRateLimiter, rateLimiters } from './rate-limit';

function appWith(limiter: express.RequestHandler) {
  const app = express();
  app.use(limiter);
  app.get('/', (_req, res) => {
    res.json({ success: true });
  });
  return app;
}

describe('createRateLimiter', () => {
  it('lets requests through up to the limit', async () => {
    const app = appWith(createRateLimiter({ max: 2, windowMs: 60_000 }));

    expect((await supertest(app).get('/')).status).toBe(200);
    expect((await supertest(app).get('/')).status).toBe(200);
  });

  it('answers 429 in the response envelope once the limit is passed', async () => {
    const app = appWith(createRateLimiter({ max: 1, windowMs: 60_000 }));
    await supertest(app).get('/');

    const res = await supertest(app).get('/');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      code: RATE_LIMITED_CODE,
      message: 'Too many requests, please try again later.',
    });
  });

  it('sends the standard RateLimit headers and not the legacy ones', async () => {
    const res = await supertest(appWith(createRateLimiter({ max: 5, windowMs: 60_000 }))).get('/');

    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('uses a caller-supplied body when one is given', async () => {
    const body = { success: false, code: RATE_LIMITED_CODE, message: 'Slow down.' };
    const app = appWith(createRateLimiter({ max: 1, windowMs: 60_000, message: body }));
    await supertest(app).get('/');

    expect((await supertest(app).get('/')).body).toEqual(body);
  });
});

describe('rateLimiters', () => {
  it.each(['standard', 'strict', 'auth'] as const)('builds the %s limiter', (name) => {
    expect(typeof rateLimiters[name]()).toBe('function');
  });

  it('answers the auth limiter in the response envelope', async () => {
    const app = appWith(rateLimiters.auth());
    let res = await supertest(app).get('/');
    // The auth limiter allows 10 requests a minute.
    for (let attempt = 0; attempt < 10; attempt += 1) res = await supertest(app).get('/');

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, code: RATE_LIMITED_CODE });
    expect(res.body.message).toMatch(/authentication attempts/);
  });
});
