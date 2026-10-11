import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AuthenticationError } from '../auth/get-auth-context';
import { createErrorHandler, createNotFoundHandler } from './error-handling';

function appThrowing(error: () => unknown) {
  const app = express();
  app.get('/boom', async () => {
    throw error();
  });
  app.use(createNotFoundHandler());
  app.use(createErrorHandler());
  return app;
}

describe('createErrorHandler', () => {
  it('answers a Zod error as 400 with the issues', async () => {
    const res = await supertest(appThrowing(() => z.object({ name: z.string() }).safeParse({}).error)).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR', message: 'Validation failed' });
    expect(res.body.details[0].path).toEqual(['name']);
  });

  it('answers an AuthenticationError as 401', async () => {
    const res = await supertest(appThrowing(() => new AuthenticationError('no session'))).get('/boom');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' });
  });

  it('answers anything else as 500 without leaking the message', async () => {
    const res = await supertest(appThrowing(() => new Error('connection string postgres://secret'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
  });
});

describe('createNotFoundHandler', () => {
  it('answers an unknown route as 404 in the envelope', async () => {
    const res = await supertest(appThrowing(() => new Error('unused'))).get('/nowhere');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, code: 'NOT_FOUND', message: 'Route not found' });
  });
});
