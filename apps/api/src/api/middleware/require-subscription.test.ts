import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { SUBSCRIPTION_STATUS } from '@/lib/billing/subscription';
import { createRequireSubscription } from './require-subscription';

const USER_ID = 'usr_test';

/** An app whose one route needs a subscription, for a user whose stored status is `status`. */
function appFor(status: string | null, signedIn = true) {
  const asked: string[] = [];
  const requireSubscription = createRequireSubscription(async (userId) => {
    asked.push(userId);
    return status;
  });

  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (signedIn) req.provisioned = { user: { id: USER_ID } };
    next();
  });
  app.get('/feature', requireSubscription, (_req, res) => {
    res.json({ success: true, data: 'unlocked' });
  });
  app.use((err: { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ success: false });
  });
  return { app, asked };
}

describe('requireSubscription', () => {
  it.each([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.PAST_DUE])(
    'lets a user whose subscription is %s through',
    async (status) => {
      const { app, asked } = appFor(status);

      const res = await supertest(app).get('/feature');

      expect(res.status).toBe(200);
      expect(asked).toEqual([USER_ID]);
    },
  );

  it.each([null, SUBSCRIPTION_STATUS.CANCELED, SUBSCRIPTION_STATUS.UNPAID, SUBSCRIPTION_STATUS.INCOMPLETE])(
    'refuses a user whose status is %s with 403 SUBSCRIPTION_REQUIRED',
    async (status) => {
      const res = await supertest(appFor(status).app).get('/feature');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'This needs a subscription.',
      });
    },
  );

  it('answers 401, and reads no status, when nobody is signed in', async () => {
    const { app, asked } = appFor(SUBSCRIPTION_STATUS.ACTIVE, false);

    const res = await supertest(app).get('/feature');

    expect(res.status).toBe(401);
    expect(asked).toEqual([]);
  });
});
