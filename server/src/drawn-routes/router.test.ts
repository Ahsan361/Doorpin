import { Writable } from 'node:stream';
import { ApiError, CreatedDrawnRoute, DrawnRoute } from '@doorpin/shared';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { connectTestDatabase } from '../db/test-database.ts';
import { listen } from '../test-server.ts';
import { at, sampleRoute } from './test-routes.ts';

const sql = connectTestDatabase();
afterAll(async () => {
  await sql.end();
});
beforeEach(async () => {
  await sql`TRUNCATE routes CASCADE`;
});

const ok = async () => undefined;

/** Starts the app, runs `fn` against it, and stops it. Returns the request log lines. */
async function withApp(fn: (url: string) => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const app = createApp({ sql, checkDatabase: ok, checkRedis: ok, logger: pino(sink) });
  const server = await listen(app);
  try {
    await fn(server.url);
  } finally {
    await server.close();
  }
  return lines.join('');
}

function send(url: string, method: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function create(url: string, body: unknown = sampleRoute()) {
  const response = await send(`${url}/api/v1/routes`, 'POST', body);
  expect(response.status).toBe(201);
  return CreatedDrawnRoute.parse(await response.json());
}

const NOT_FOUND = {
  error: { code: 'ROUTE_NOT_FOUND', message: 'No such route, or the edit link is wrong.' },
};

describe('POST /api/v1/routes', () => {
  it('saves a route and returns its id and owner token, uncached', async () => {
    await withApp(async (url) => {
      const response = await send(`${url}/api/v1/routes`, 'POST', sampleRoute());
      expect(response.status).toBe(201);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const created = CreatedDrawnRoute.parse(await response.json());
      const [row] = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM routes WHERE id = ${created.routeId}
      `;
      expect(row?.n).toBe(1);
    });
  });

  it('rejects an invalid route with 400 and says what is wrong', async () => {
    await withApp(async (url) => {
      const body = { ...sampleRoute(), door: at(500, 500), extra: true };
      const response = await send(`${url}/api/v1/routes`, 'POST', body);
      expect(response.status).toBe(400);
      const error = ApiError.parse(await response.json()).error;
      expect(error.code).toBe('INVALID_ROUTE');
      expect(error.details?.map((detail) => detail.path)).toContain('');
    });
  });

  it('reports each broken field when the shape is right', async () => {
    await withApp(async (url) => {
      const body = { ...sampleRoute(), door: at(500, 500) };
      const response = await send(`${url}/api/v1/routes`, 'POST', body);
      expect(response.status).toBe(400);
      expect(ApiError.parse(await response.json()).error.details?.[0]?.path).toBe('door');
    });
  });

  it('answers 400, not 500, for a NUL character in a note', async () => {
    await withApp(async (url) => {
      const body = { ...sampleRoute(), landmarks: [{ position: at(5, 50), note: 'Gate\u0000' }] };
      const response = await send(`${url}/api/v1/routes`, 'POST', body);
      expect(response.status).toBe(400);
      expect(ApiError.parse(await response.json()).error.code).toBe('INVALID_ROUTE');
    });
  });
});

describe('GET /api/v1/routes/:id', () => {
  it('returns the route to its owner', async () => {
    await withApp(async (url) => {
      const { routeId, ownerToken } = await create(url);
      const response = await send(`${url}/api/v1/routes/${routeId}`, 'GET', undefined, ownerToken);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const route = DrawnRoute.parse(await response.json());
      expect(route.id).toBe(routeId);
      expect(route.landmarks.map((landmark) => landmark.note)).toEqual([
        'Pass the mosque',
        'Turn left at the green gate',
      ]);
      expect(JSON.stringify(route)).not.toContain(ownerToken);
    });
  });

  it('gives the same 404 for a wrong, missing or other route token, and for unknown or malformed ids', async () => {
    await withApp(async (url) => {
      const a = await create(url);
      const b = await create(url);
      const unknownId = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
      const attempts: Array<[string, string | undefined]> = [
        [a.routeId, b.ownerToken],
        [a.routeId, undefined],
        [a.routeId, 'too-short'],
        [a.routeId, 'a'.repeat(22)],
        [unknownId, a.ownerToken],
        ['not-a-uuid', a.ownerToken],
        ["1' OR '1'='1", a.ownerToken],
      ];
      for (const [id, token] of attempts) {
        const response = await send(
          `${url}/api/v1/routes/${encodeURIComponent(id)}`,
          'GET',
          undefined,
          token,
        );
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual(NOT_FOUND);
      }
    });
  });
});

describe('PUT /api/v1/routes/:id', () => {
  it('replaces the route for its owner and returns the new version', async () => {
    await withApp(async (url) => {
      const { routeId, ownerToken } = await create(url);
      const replacement = {
        door: at(10, 110),
        path: [at(0, 0), at(0, 100)],
        landmarks: [{ position: at(2, 80), note: 'Yellow wall' }],
      };
      const response = await send(
        `${url}/api/v1/routes/${routeId}`,
        'PUT',
        replacement,
        ownerToken,
      );
      expect(response.status).toBe(200);
      const route = DrawnRoute.parse(await response.json());
      expect(route.title).toBeNull();
      expect(route.path).toHaveLength(2);
      expect(route.landmarks.map((landmark) => landmark.note)).toEqual(['Yellow wall']);
    });
  });

  it('checks the token before the body: without it, even a bad body gets 404', async () => {
    await withApp(async (url) => {
      const { routeId } = await create(url);
      const response = await send(`${url}/api/v1/routes/${routeId}`, 'PUT', { nonsense: 1 });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND);
    });
  });

  it('does not let one route token change another route', async () => {
    await withApp(async (url) => {
      const a = await create(url);
      const b = await create(url);
      const response = await send(
        `${url}/api/v1/routes/${a.routeId}`,
        'PUT',
        sampleRoute(),
        b.ownerToken,
      );
      expect(response.status).toBe(404);
    });
  });

  it('rejects an invalid replacement from the owner with 400', async () => {
    await withApp(async (url) => {
      const { routeId, ownerToken } = await create(url);
      const body = { ...sampleRoute(), path: [at(0, 0)] };
      const response = await send(`${url}/api/v1/routes/${routeId}`, 'PUT', body, ownerToken);
      expect(response.status).toBe(400);
      expect(ApiError.parse(await response.json()).error.code).toBe('INVALID_ROUTE');
    });
  });
});

describe('owner token privacy', () => {
  it('never writes the owner token or coordinates to the request log', async () => {
    let token = '';
    const log = await withApp(async (url) => {
      const { routeId, ownerToken } = await create(url);
      token = ownerToken;
      await send(`${url}/api/v1/routes/${routeId}`, 'GET', undefined, ownerToken);
      await send(`${url}/api/v1/routes/${routeId}`, 'PUT', sampleRoute(), ownerToken);
    });
    expect(log).toContain('/api/v1/routes');
    expect(log).not.toContain(token);
    expect(log).not.toContain(String(sampleRoute().door.lat));
  });
});
