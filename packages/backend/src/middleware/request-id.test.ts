import { Writable } from 'node:stream';

import express from 'express';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import winston from 'winston';

import logger, { apiLogger } from '../utils/logger';
import { getRequestId } from '../utils/request-context';

import { createRequestIdMiddleware, REQUEST_ID_HEADER } from './request-id';

const GENERATED_ID = 'generated-id-1';

/** An app with the middleware first, then the JSON parser, as `Backend` mounts them. */
function buildApp(generate: () => string = () => GENERATED_ID) {
  const app = express();
  app.use(createRequestIdMiddleware(generate));
  app.use(express.json());
  app.post('/echo', async (req, res) => {
    const before = getRequestId();
    apiLogger.info('handling', { step: 'before' });
    // Wait for the gate when the test set one, so two requests can overlap.
    await (req.body?.gate === true ? gate.promise : Promise.resolve());
    apiLogger.info('handling', { step: 'after' });
    res.json({ before, after: getRequestId() });
  });
  return app;
}

/** Holds a request open until the test releases it. */
let gate: { promise: Promise<void>; release: () => void };

function newGate() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('createRequestIdMiddleware', () => {
  /** Every line the real logger writes during a test, as the JSON it would ship. */
  let lines: Record<string, unknown>[];
  let capture: winston.transport;

  beforeEach(() => {
    gate = newGate();
    lines = [];
    capture = new winston.transports.Stream({
      stream: new Writable({
        write(chunk: Buffer, _encoding, done) {
          lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
          done();
        },
      }),
      format: winston.format.json(),
    });
    logger.add(capture);
  });

  afterEach(() => {
    logger.remove(capture);
  });

  it('generates an id when the request brings none, and answers with it', async () => {
    const res = await supertest(buildApp()).post('/echo').send({});

    expect(res.headers[REQUEST_ID_HEADER.toLowerCase()]).toBe(GENERATED_ID);
    expect(res.body).toEqual({ before: GENERATED_ID, after: GENERATED_ID });
  });

  it('generates a UUID by default', async () => {
    const app = express();
    app.use(createRequestIdMiddleware());
    app.get('/', (_req, res) => void res.json({ id: getRequestId() }));

    const res = await supertest(app).get('/');

    expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.headers['x-request-id']).toBe(res.body.id);
  });

  it.each(['abc-123', 'req_01HZX.a-b', 'A'.repeat(64)])('keeps a short, safe incoming id: %s', async (incoming) => {
    const res = await supertest(buildApp()).post('/echo').set(REQUEST_ID_HEADER, incoming).send({});

    expect(res.headers['x-request-id']).toBe(incoming);
    expect(res.body).toEqual({ before: incoming, after: incoming });
  });

  it.each([
    ['too long', 'A'.repeat(65)],
    ['a space', 'abc def'],
    ['a quote', 'abc"def'],
    ['a brace, as in a forged log field', '{"level":"error"}'],
    ['a slash', '../../etc/passwd'],
    ['empty', ''],
  ])('replaces an incoming id that is not safe (%s)', async (_case, incoming) => {
    const res = await supertest(buildApp()).post('/echo').set(REQUEST_ID_HEADER, incoming).send({});

    expect(res.headers['x-request-id']).toBe(GENERATED_ID);
    expect(res.body.before).toBe(GENERATED_ID);
  });

  it('puts the id on every log line written while the request is handled, across an await and a parsed body', async () => {
    await supertest(buildApp()).post('/echo').set(REQUEST_ID_HEADER, 'trace-me').send({ some: 'body' });

    const handling = lines.filter((line) => line['message'] === 'handling');
    expect(handling).toEqual([
      expect.objectContaining({ step: 'before', requestId: 'trace-me', service: 'api' }),
      expect.objectContaining({ step: 'after', requestId: 'trace-me', service: 'api' }),
    ]);
  });

  it('leaves a line written outside a request without an id', () => {
    apiLogger.info('starting up');

    expect(getRequestId()).toBeUndefined();
    expect(lines.find((line) => line['message'] === 'starting up')).not.toHaveProperty('requestId');
  });

  it('keeps overlapping requests apart', async () => {
    const app = buildApp();

    const held = supertest(app).post('/echo').set(REQUEST_ID_HEADER, 'first').send({ gate: true }).then((res) => res);
    const quick = await supertest(app).post('/echo').set(REQUEST_ID_HEADER, 'second').send({});
    gate.release();
    const slow = await held;

    expect(quick.body).toEqual({ before: 'second', after: 'second' });
    expect(slow.body).toEqual({ before: 'first', after: 'first' });
    const ids = lines.filter((line) => line['message'] === 'handling').map((line) => `${String(line['requestId'])}:${String(line['step'])}`);
    expect(ids).toEqual(['first:before', 'second:before', 'second:after', 'first:after']);
  });
});
