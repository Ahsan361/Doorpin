import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase } from './test-database.ts';

const sql = connectTestDatabase();
afterAll(async () => {
  await sql.end();
});
beforeEach(async () => {
  await sql`TRUNCATE routes CASCADE`;
});

const HASH = 'a'.repeat(64);
const PATH = 'LINESTRING(73.0800 33.6600, 73.0810 33.6600)';
const DOOR = 'POINT(73.0811 33.6601)';

async function insertRoute(overrides: { hash?: string; title?: string; path?: string } = {}) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO routes (owner_token_hash, title, path, door, length_m)
    VALUES (
      ${overrides.hash ?? HASH}, ${overrides.title ?? null},
      ST_GeogFromText(${overrides.path ?? PATH}), ST_GeogFromText(${DOOR}), 93
    )
    RETURNING id
  `;
  if (row === undefined) throw new Error('insert returned no row');
  return row.id;
}

describe('database schema', () => {
  it('runs against the test database, never the dev one', async () => {
    const [row] = await sql<{ name: string }[]>`SELECT current_database() AS name`;
    expect(row?.name).toBe('doorpin_test');
  });

  it('stores a route and its landmarks, and deleting the route deletes them', async () => {
    const routeId = await insertRoute();
    await sql`
      INSERT INTO landmarks (route_id, position, along_m, note)
      VALUES (${routeId}, ST_GeogFromText('POINT(73.0805 33.6600)'), 46, 'Green gate')
    `;
    const [measured] = await sql<{ meters: number }[]>`
      SELECT ST_Length(path) AS meters FROM routes WHERE id = ${routeId}
    `;
    expect(measured?.meters).toBeGreaterThan(90);
    expect(measured?.meters).toBeLessThan(96);

    await sql`DELETE FROM routes WHERE id = ${routeId}`;
    const [left] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM landmarks`;
    expect(left?.count).toBe(0);
  });

  it('rejects a bad token hash, a long title and a path that is not a line', async () => {
    await expect(insertRoute({ hash: 'not-a-hash' })).rejects.toThrow(/owner_token_hash/);
    await expect(insertRoute({ title: 'a'.repeat(121) })).rejects.toThrow(/title/);
    await expect(insertRoute({ path: 'POINT(73.08 33.66)' })).rejects.toThrow();
  });

  it('rejects an empty landmark note', async () => {
    const routeId = await insertRoute();
    await expect(sql`
      INSERT INTO landmarks (route_id, position, along_m, note)
      VALUES (${routeId}, ST_GeogFromText('POINT(73.0805 33.6600)'), 46, '')
    `).rejects.toThrow(/note/);
  });
});
