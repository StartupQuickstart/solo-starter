import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { RATE_LIMIT_MESSAGE, rateLimitByIp, rateLimitByUser } from './rate-limit';

const WINDOW_MS = 60_000;

/** A clock the test moves by hand. */
function manualClock(start = 1_000_000) {
  let current = start;
  return { now: () => current, advance: (ms: number) => (current += ms) };
}

function appWith(limiter: express.RequestHandler, userId?: string) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) req.provisioned = { user: { id: userId, clerkId: `clerk_${userId}` } };
    next();
  });
  app.get('/limited', limiter, (_req, res) => {
    res.json({ success: true, data: 'ok' });
  });
  app.use((err: { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ success: false });
  });
  return app;
}

describe('rateLimitByIp', () => {
  it('lets requests through up to the limit', async () => {
    const app = appWith(rateLimitByIp({ limit: 2, windowMs: WINDOW_MS, now: manualClock().now }));

    expect((await supertest(app).get('/limited')).status).toBe(200);
    expect((await supertest(app).get('/limited')).status).toBe(200);
  });

  it('answers 429 in the response envelope once the limit is passed', async () => {
    const app = appWith(rateLimitByIp({ limit: 1, windowMs: WINDOW_MS, now: manualClock().now }));
    await supertest(app).get('/limited');

    const res = await supertest(app).get('/limited');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, code: 'RATE_LIMITED', message: RATE_LIMIT_MESSAGE });
    expect(res.headers['retry-after']).toBe('60');
  });

  it('lets requests through again when the window has passed', async () => {
    const clock = manualClock();
    const app = appWith(rateLimitByIp({ limit: 1, windowMs: WINDOW_MS, now: clock.now }));
    await supertest(app).get('/limited');
    expect((await supertest(app).get('/limited')).status).toBe(429);

    clock.advance(WINDOW_MS + 1);

    expect((await supertest(app).get('/limited')).status).toBe(200);
  });

  it('does not count a refused request against the window', async () => {
    const clock = manualClock();
    const app = appWith(rateLimitByIp({ limit: 1, windowMs: WINDOW_MS, now: clock.now }));
    await supertest(app).get('/limited');

    // Refused requests late in the window must not push the reset further out.
    clock.advance(WINDOW_MS - 1);
    await supertest(app).get('/limited');
    clock.advance(2);

    expect((await supertest(app).get('/limited')).status).toBe(200);
  });
});

describe('rateLimitByUser', () => {
  it('counts each user separately', async () => {
    const limiter = rateLimitByUser({ limit: 1, windowMs: WINDOW_MS, now: manualClock().now });
    const alice = appWith(limiter, 'usr_alice');
    const bob = appWith(limiter, 'usr_bob');

    await supertest(alice).get('/limited');

    expect((await supertest(alice).get('/limited')).status).toBe(429);
    expect((await supertest(bob).get('/limited')).status).toBe(200);
  });

  it('refuses a request with no signed-in user instead of counting it', async () => {
    const app = appWith(rateLimitByUser({ limit: 1, windowMs: WINDOW_MS, now: manualClock().now }));

    const res = await supertest(app).get('/limited');

    expect(res.status).toBe(401);
  });

  it('keeps a separate count for each limited route', async () => {
    const clock = manualClock();
    const first = appWith(rateLimitByUser({ limit: 1, windowMs: WINDOW_MS, now: clock.now }), 'usr_alice');
    const second = appWith(rateLimitByUser({ limit: 1, windowMs: WINDOW_MS, now: clock.now }), 'usr_alice');

    await supertest(first).get('/limited');

    expect((await supertest(second).get('/limited')).status).toBe(200);
  });
});
