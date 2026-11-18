import { Writable } from 'node:stream';
import { HealthResponse } from '@doorpin/shared';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp, type AppDeps, type HealthCheck } from './app.ts';
import { connectTestDatabase } from './db/test-database.ts';
import { listen } from './test-server.ts';

const sql = connectTestDatabase();
afterAll(async () => {
  await sql.end();
});

const ok: HealthCheck = async () => undefined;
const failing: HealthCheck = async () => {
  throw new Error('connection refused');
};
const hanging: HealthCheck = () => new Promise(() => {});

async function request(deps: Partial<AppDeps>, path: string, init?: RequestInit) {
  const app = createApp({ sql, checkDatabase: ok, checkRedis: ok, checkTimeoutMs: 50, ...deps });
  const server = await listen(app);
  try {
    const response = await fetch(server.url + path, init);
    return { response, body: (await response.json()) as unknown };
  } finally {
    await server.close();
  }
}

describe('GET /api/v1/healthz', () => {
  it('returns 200 when the database and Redis are reachable', async () => {
    const { response, body } = await request({}, '/api/v1/healthz');
    expect(response.status).toBe(200);
    expect(HealthResponse.parse(body)).toEqual({
      status: 'ok',
      checks: { database: 'ok', redis: 'ok' },
    });
  });

  it('returns 503 and names the failing dependency', async () => {
    const { response, body } = await request({ checkRedis: failing }, '/api/v1/healthz');
    expect(response.status).toBe(503);
    expect(HealthResponse.parse(body)).toEqual({
      status: 'error',
      checks: { database: 'ok', redis: 'error' },
    });
  });

  it('treats a check that never answers as failed', async () => {
    const { response, body } = await request({ checkDatabase: hanging }, '/api/v1/healthz');
    expect(response.status).toBe(503);
    expect(HealthResponse.parse(body).checks.database).toBe('error');
  });
});

describe('app-wide behavior', () => {
  it('answers unknown routes with a JSON 404', async () => {
    const { response, body } = await request({}, '/api/v1/nope');
    expect(response.status).toBe(404);
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } });
  });

  it('rejects malformed JSON with a JSON 400', async () => {
    const { response, body } = await request({}, '/api/v1/healthz', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });
    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
    });
  });

  it('does not reveal the framework in a response header', async () => {
    const { response } = await request({}, '/api/v1/healthz');
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('keeps the Authorization header out of the request log', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    await request({ logger: pino(sink) }, '/api/v1/healthz', {
      headers: { authorization: 'Bearer secret-token-123' },
    });
    const log = lines.join('');
    expect(log).toContain('/api/v1/healthz');
    expect(log).toContain('[Redacted]');
    expect(log).not.toContain('secret-token-123');
  });
});
