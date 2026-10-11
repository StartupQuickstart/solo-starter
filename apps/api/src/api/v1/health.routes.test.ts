import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { AUTH_EXEMPT_PATHS } from '@app/backend';
import { createHealthRouter, HEALTH_SERVICE_NAME } from './health.routes';

describe('createHealthRouter', () => {
  it.each(AUTH_EXEMPT_PATHS)('answers ok on %s without auth', async (path) => {
    const app = express();
    app.use(createHealthRouter());

    const res = await supertest(app).get(path);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: HEALTH_SERVICE_NAME });
  });
});
