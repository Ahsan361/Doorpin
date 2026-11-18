import distance from '@turf/distance';
import { lineString, point } from '@turf/helpers';
import length from '@turf/length';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { z } from 'zod';

/** A point on the map. The API always uses this shape; MapLibre and PostGIS want [lng, lat] instead. */
export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

/** Converts to the [lng, lat] order used by GeoJSON, MapLibre and PostGIS. */
export function toLngLat(p: LatLng): [number, number] {
  return [p.lng, p.lat];
}

/** Straight-line distance between two points, in meters. */
export function distanceM(a: LatLng, b: LatLng): number {
  return distance(point(toLngLat(a)), point(toLngLat(b)), { units: 'meters' });
}

/** Total length of a path, in meters. */
export function pathLengthM(path: readonly LatLng[]): number {
  if (path.length < 2) return 0;
  return length(lineString(path.map(toLngLat)), { units: 'meters' });
}

/** Shortest distance from a point to any part of a path, in meters. */
export function distanceToPathM(p: LatLng, path: readonly LatLng[]): number {
  const [first] = path;
  if (first === undefined) return Infinity;
  if (path.length === 1) return distanceM(p, first);
  const nearest = nearestPointOnLine(lineString(path.map(toLngLat)), point(toLngLat(p)), {
    units: 'meters',
  });
  return nearest.properties.pointDistance;
}
