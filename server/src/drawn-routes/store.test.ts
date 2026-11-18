import type { LatLng } from '@doorpin/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase } from '../db/test-database.ts';
import { createOwnerToken } from './owner-token.ts';
import {
  findDrawnRoute,
  findOwnerTokenHash,
  insertDrawnRoute,
  replaceDrawnRoute,
} from './store.ts';
import { at, sampleRoute } from './test-routes.ts';

const sql = connectTestDatabase();
afterAll(async () => {
  await sql.end();
});
beforeEach(async () => {
  await sql`TRUNCATE routes CASCADE`;
});

const UNKNOWN_ID = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';

function expectNear(actual: LatLng | undefined, expected: LatLng) {
  expect(actual?.lat).toBeCloseTo(expected.lat, 7);
  expect(actual?.lng).toBeCloseTo(expected.lng, 7);
}

describe('drawn route store', () => {
  it('saves a route and reads it back the same, with lengths measured by PostGIS', async () => {
    const input = sampleRoute();
    const id = await insertDrawnRoute(sql, input, createOwnerToken().hash);
    const route = await findDrawnRoute(sql, id);

    expect(route?.title).toBe('House 12, Street 4');
    expectNear(route?.door, input.door);
    expect(route?.path).toHaveLength(3);
    input.path.forEach((point, i) => expectNear(route?.path[i], point));
    expect(route?.lengthM).toBeGreaterThan(245);
    expect(route?.lengthM).toBeLessThan(255);
  });

  it('stores the path with the entry point first', async () => {
    const id = await insertDrawnRoute(sql, sampleRoute(), createOwnerToken().hash);
    const [row] = await sql<{ lng: number; lat: number }[]>`
      SELECT ST_X(ST_StartPoint(path::geometry)) AS lng, ST_Y(ST_StartPoint(path::geometry)) AS lat
      FROM routes WHERE id = ${id}
    `;
    expectNear(row, at(0, 0));
  });

  it('orders landmarks from the entry point and measures how far along the path each is', async () => {
    const id = await insertDrawnRoute(sql, sampleRoute(), createOwnerToken().hash);
    const route = await findDrawnRoute(sql, id);
    expect(route?.landmarks.map((landmark) => landmark.note)).toEqual([
      'Pass the mosque',
      'Turn left at the green gate',
    ]);
    expect(route?.landmarks[0]?.alongM).toBeCloseTo(50, -1);
    expect(route?.landmarks[1]?.alongM).toBeCloseTo(150, -1);
  });

  it('measures landmarks correctly along a diagonal path, on either side of it', async () => {
    // A 424 m path running north-east. Both landmarks sit 30 m off it, on opposite sides,
    // level with the point 200 m along it.
    const input = {
      door: at(310, 310),
      path: [at(0, 0), at(300, 300)],
      landmarks: [
        { position: at(141.42 + 21.21, 141.42 - 21.21), note: 'South-east side' },
        { position: at(141.42 - 21.21, 141.42 + 21.21), note: 'North-west side' },
      ],
    };
    const id = await insertDrawnRoute(sql, input, createOwnerToken().hash);
    const route = await findDrawnRoute(sql, id);
    for (const landmark of route?.landmarks ?? []) {
      expect(Math.abs(landmark.alongM - 200)).toBeLessThan(1);
    }
    expect(route?.landmarks).toHaveLength(2);
  });

  it('stores the owner token hash, never the token', async () => {
    const { token, hash } = createOwnerToken();
    const id = await insertDrawnRoute(sql, sampleRoute(), hash);
    expect(await findOwnerTokenHash(sql, id)).toBe(hash);
    const [found] = await sql`
      SELECT 1 FROM routes WHERE owner_token_hash = ${token} OR title = ${token}
    `;
    expect(found).toBeUndefined();
  });

  it('stores an empty title as no title', async () => {
    const id = await insertDrawnRoute(
      sql,
      { ...sampleRoute(), title: '' },
      createOwnerToken().hash,
    );
    expect((await findDrawnRoute(sql, id))?.title).toBeNull();
  });

  it('handles a path whose points are all the same (a double tap)', async () => {
    const spot = at(50, 200);
    const input = {
      door: at(60, 210),
      path: [spot, spot],
      landmarks: [{ position: at(55, 200), note: 'Blue door' }],
    };
    const id = await insertDrawnRoute(sql, input, createOwnerToken().hash);
    const route = await findDrawnRoute(sql, id);
    expect(route?.lengthM).toBe(0);
    expect(Number.isFinite(route?.landmarks[0]?.alongM)).toBe(true);
  });

  it('replaces the path and landmarks, drops the old landmarks and moves updatedAt', async () => {
    const id = await insertDrawnRoute(sql, sampleRoute(), createOwnerToken().hash);
    const before = await findDrawnRoute(sql, id);

    const replacement = {
      title: 'New gate',
      door: at(10, 110),
      path: [at(0, 0), at(0, 100)],
      landmarks: [{ position: at(2, 80), note: 'Yellow wall' }],
    };
    expect(await replaceDrawnRoute(sql, id, replacement)).toBe(true);

    const after = await findDrawnRoute(sql, id);
    expect(after?.title).toBe('New gate');
    expect(after?.path).toHaveLength(2);
    expect(after?.lengthM).toBeCloseTo(100, -1);
    expect(after?.landmarks.map((landmark) => landmark.note)).toEqual(['Yellow wall']);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(Date.parse(after?.updatedAt ?? '')).toBeGreaterThan(Date.parse(before?.updatedAt ?? ''));
    const [count] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM landmarks`;
    expect(count?.n).toBe(1);
  });

  it('reports a missing route', async () => {
    expect(await findDrawnRoute(sql, UNKNOWN_ID)).toBeUndefined();
    expect(await findOwnerTokenHash(sql, UNKNOWN_ID)).toBeUndefined();
    expect(await replaceDrawnRoute(sql, UNKNOWN_ID, sampleRoute())).toBe(false);
  });
});
