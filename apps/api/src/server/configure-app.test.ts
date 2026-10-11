import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { configureApp } from './configure-app';

const CLIENT_ADDRESS = '203.0.113.7';
const FORGED_ADDRESS = '198.51.100.99';

function appBehind(trustProxyHops: number) {
  const app = express();
  configureApp(app, { trustProxyHops });
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

describe('configureApp', () => {
  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    const res = await supertest(appBehind(0)).get('/ip').set('X-Forwarded-For', CLIENT_ADDRESS);

    expect(res.body.ip).not.toBe(CLIENT_ADDRESS);
  });

  it('reads the client address from the one trusted proxy', async () => {
    const res = await supertest(appBehind(1)).get('/ip').set('X-Forwarded-For', CLIENT_ADDRESS);

    expect(res.body.ip).toBe(CLIENT_ADDRESS);
  });

  it('does not let the client choose its own address', async () => {
    // The client sends a forged entry; the trusted proxy appends the real one.
    const res = await supertest(appBehind(1))
      .get('/ip')
      .set('X-Forwarded-For', `${FORGED_ADDRESS}, ${CLIENT_ADDRESS}`);

    expect(res.body.ip).toBe(CLIENT_ADDRESS);
  });

  it('turns ETags off so a repeat request is never answered 304', async () => {
    const app = appBehind(0);

    const first = await supertest(app).get('/ip');
    const second = await supertest(app).get('/ip').set('If-None-Match', first.headers['etag'] ?? '"anything"');

    expect(first.headers['etag']).toBeUndefined();
    expect(second.status).toBe(200);
  });
});
