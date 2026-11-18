import { describe, expect, it } from 'vitest';
import { distanceM, distanceToPathM, pathLengthM, toLngLat, type LatLng } from './geo.ts';

/** A point `northM` meters north and `eastM` meters east of a spot in Islamabad. */
function at(northM: number, eastM: number): LatLng {
  const lat = 33.66;
  return {
    lat: lat + northM / 111_320,
    lng: 73.08 + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

describe('geo helpers', () => {
  it('converts to [lng, lat] order', () => {
    expect(toLngLat({ lat: 33.6, lng: 73.1 })).toEqual([73.1, 33.6]);
  });

  it('measures the distance between two points in meters', () => {
    expect(distanceM(at(0, 0), at(100, 0))).toBeCloseTo(100, 0);
    expect(distanceM(at(0, 0), at(0, 100))).toBeCloseTo(100, 0);
  });

  it('measures the length of a path', () => {
    expect(pathLengthM([at(0, 0), at(0, 200), at(50, 200)])).toBeCloseTo(250, 0);
    expect(pathLengthM([at(0, 0)])).toBe(0);
  });

  it('measures how far a point is from a path', () => {
    const path = [at(0, 0), at(0, 200), at(50, 200)];
    expect(distanceToPathM(at(20, 100), path)).toBeCloseTo(20, 0);
    expect(distanceToPathM(at(0, 100), path)).toBeCloseTo(0, 0);
  });

  it('copes with repeated points (a double tap on the phone)', () => {
    const p = at(0, 0);
    expect(distanceToPathM(at(40, 0), [p, p])).toBeCloseTo(40, 0);
    expect(distanceToPathM(at(40, 100), [p, p, at(0, 200), at(0, 200)])).toBeCloseTo(40, 0);
  });
});
