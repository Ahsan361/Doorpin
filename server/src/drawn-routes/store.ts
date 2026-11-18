import { toLngLat, type DrawnRoute, type DrawnRouteInput, type LatLng } from '@doorpin/shared';
import type { Sql, TransactionSql } from 'postgres';
import { z } from 'zod';

// Points and lines go to PostGIS as GeoJSON text in a query parameter, never spliced into SQL.
function lineJson(path: readonly LatLng[]): string {
  return JSON.stringify({ type: 'LineString', coordinates: path.map(toLngLat) });
}
function pointJson(p: LatLng): string {
  return JSON.stringify({ type: 'Point', coordinates: toLngLat(p) });
}

const GeoJsonPoint = z.object({ coordinates: z.tuple([z.number(), z.number()]) });
const GeoJsonLine = z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) });
const fromLngLat = ([lng, lat]: [number, number]): LatLng => ({ lat, lng });

/** An empty or missing title is stored as null. */
function titleOrNull(route: DrawnRouteInput): string | null {
  return route.title === undefined || route.title === '' ? null : route.title;
}

/**
 * Adds landmarks to a route. `along_m` is measured by PostGIS on the sphere (geography), because
 * locating in plain lng/lat degrees is off by several meters on diagonal streets.
 */
async function insertLandmarks(
  tx: TransactionSql,
  routeId: string,
  landmarks: DrawnRouteInput['landmarks'],
): Promise<void> {
  for (const landmark of landmarks) {
    await tx`
      INSERT INTO landmarks (route_id, position, along_m, note)
      SELECT r.id, p.pos,
             CASE WHEN r.length_m = 0 THEN 0 ELSE ST_LineLocatePoint(r.path, p.pos) * r.length_m END,
             ${landmark.note}
      FROM routes r,
           (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${pointJson(landmark.position)}), 4326)::geography AS pos) p
      WHERE r.id = ${routeId}
    `;
  }
}

/** Saves a new drawn route with its landmarks. Returns the new route's id. */
export async function insertDrawnRoute(
  sql: Sql,
  route: DrawnRouteInput,
  ownerTokenHash: string,
): Promise<string> {
  const path = lineJson(route.path);
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO routes (owner_token_hash, title, path, door, length_m)
      VALUES (
        ${ownerTokenHash},
        ${titleOrNull(route)},
        ST_SetSRID(ST_GeomFromGeoJSON(${path}), 4326)::geography,
        ST_SetSRID(ST_GeomFromGeoJSON(${pointJson(route.door)}), 4326)::geography,
        ST_Length(ST_SetSRID(ST_GeomFromGeoJSON(${path}), 4326)::geography)
      )
      RETURNING id
    `;
    if (row === undefined) throw new Error('insert into routes returned no row');
    await insertLandmarks(tx, row.id, route.landmarks);
    return row.id;
  });
}

/** Replaces a route's title, door, path and landmarks. Returns false if the route doesn't exist. */
export async function replaceDrawnRoute(
  sql: Sql,
  id: string,
  route: DrawnRouteInput,
): Promise<boolean> {
  const path = lineJson(route.path);
  return sql.begin(async (tx) => {
    const updated = await tx`
      UPDATE routes SET
        title = ${titleOrNull(route)},
        path = ST_SetSRID(ST_GeomFromGeoJSON(${path}), 4326)::geography,
        door = ST_SetSRID(ST_GeomFromGeoJSON(${pointJson(route.door)}), 4326)::geography,
        length_m = ST_Length(ST_SetSRID(ST_GeomFromGeoJSON(${path}), 4326)::geography),
        updated_at = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (updated.length === 0) return false;
    await tx`DELETE FROM landmarks WHERE route_id = ${id}`;
    await insertLandmarks(tx, id, route.landmarks);
    return true;
  });
}

/** The stored owner token hash of a route, or undefined if the route doesn't exist. */
export async function findOwnerTokenHash(sql: Sql, id: string): Promise<string | undefined> {
  const [row] = await sql<{ hash: string }[]>`
    SELECT owner_token_hash AS hash FROM routes WHERE id = ${id}
  `;
  return row?.hash;
}

interface RouteRow {
  id: string;
  title: string | null;
  path: string;
  door: string;
  lengthM: number;
  createdAt: Date;
  updatedAt: Date;
}

interface LandmarkRow {
  id: string;
  position: string;
  note: string;
  alongM: number;
}

/** A saved route with its landmarks (entry point first), or undefined if it doesn't exist. */
export async function findDrawnRoute(sql: Sql, id: string): Promise<DrawnRoute | undefined> {
  // One snapshot for both reads, so a replace running at the same time can't pair
  // the new path with the old landmarks.
  const { route, landmarks } = await sql.begin('isolation level repeatable read', async (tx) => {
    const [route] = await tx<RouteRow[]>`
      SELECT id, title,
             ST_AsGeoJSON(path::geometry) AS path,
             ST_AsGeoJSON(door::geometry) AS door,
             length_m AS "lengthM", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM routes WHERE id = ${id}
    `;
    const landmarks = await tx<LandmarkRow[]>`
      SELECT id, ST_AsGeoJSON(position::geometry) AS position, note, along_m AS "alongM"
      FROM landmarks WHERE route_id = ${id}
      ORDER BY along_m, id
    `;
    return { route, landmarks: [...landmarks] };
  });
  if (route === undefined) return undefined;

  return {
    id: route.id,
    title: route.title,
    door: fromLngLat(GeoJsonPoint.parse(JSON.parse(route.door)).coordinates),
    path: GeoJsonLine.parse(JSON.parse(route.path)).coordinates.map(fromLngLat),
    lengthM: route.lengthM,
    landmarks: landmarks.map((landmark) => ({
      id: landmark.id,
      position: fromLngLat(GeoJsonPoint.parse(JSON.parse(landmark.position)).coordinates),
      note: landmark.note,
      alongM: landmark.alongM,
    })),
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  };
}
