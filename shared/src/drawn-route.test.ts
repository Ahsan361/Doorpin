import { describe, expect, it } from 'vitest';
import { CreatedDrawnRoute, DrawnRoute, DrawnRouteInput } from './drawn-route.ts';
import type { LatLng } from './geo.ts';

/** A point `northM` meters north and `eastM` meters east of a spot in Islamabad. */
function at(northM: number, eastM: number): LatLng {
  const lat = 33.66;
  return {
    lat: lat + northM / 111_320,
    lng: 73.08 + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

/** Entry point at (0, 0), house end at (50, 200), door about 14 m beyond it. */
function validRoute(): DrawnRouteInput {
  return {
    title: 'House 12, Street 4',
    door: at(60, 210),
    path: [at(0, 0), at(0, 200), at(50, 200)],
    landmarks: [{ position: at(5, 100), note: 'Turn left after the green gate' }],
  };
}

function issuePaths(input: unknown): string[] {
  const result = DrawnRouteInput.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('DrawnRouteInput', () => {
  it('accepts a valid route and keeps the rider order of the path', () => {
    const route = validRoute();
    const parsed = DrawnRouteInput.parse(route);
    expect(parsed.path[0]).toEqual(at(0, 0));
    expect(parsed.path.at(-1)).toEqual(at(50, 200));
  });

  it('accepts a route without a title or landmarks', () => {
    const route = validRoute();
    delete route.title;
    route.landmarks = [];
    expect(DrawnRouteInput.safeParse(route).success).toBe(true);
  });

  it('trims landmark notes and titles', () => {
    const route = validRoute();
    route.title = '  Home  ';
    route.landmarks = [{ position: at(5, 100), note: '  Green gate ' }];
    const parsed = DrawnRouteInput.parse(route);
    expect(parsed.title).toBe('Home');
    expect(parsed.landmarks[0]?.note).toBe('Green gate');
  });

  it('rejects a path with fewer than 2 or more than 500 points', () => {
    expect(issuePaths({ ...validRoute(), path: [at(50, 200)] })).toContain('path');
    const tooMany = Array.from({ length: 501 }, (_, i) => at(50, i * 0.4));
    expect(issuePaths({ ...validRoute(), path: tooMany })).toContain('path');
  });

  it('rejects a path longer than 5 km', () => {
    const route = { ...validRoute(), path: [at(0, -5500), at(0, 0), at(0, 200), at(50, 200)] };
    expect(issuePaths(route)).toEqual(['path']);
  });

  it('rejects a door more than 100 m from the house end of the path', () => {
    expect(issuePaths({ ...validRoute(), door: at(200, 200) })).toEqual(['door']);
  });

  it('measures the door from the last point, not the entry point', () => {
    // Close to the entry point but about 200 m from the house end.
    expect(issuePaths({ ...validRoute(), door: at(10, 0) })).toEqual(['door']);
  });

  it('rejects a landmark more than 30 m from the path', () => {
    const route = validRoute();
    route.landmarks = [
      { position: at(5, 100), note: 'Near' },
      { position: at(-60, 100), note: 'Too far' },
    ];
    expect(issuePaths(route)).toEqual(['landmarks.1.position']);
  });

  it('still checks landmark distance when the path has repeated points', () => {
    const route = validRoute();
    route.path = [at(0, 0), at(0, 0), at(0, 200), at(0, 200), at(50, 200)];
    route.landmarks = [{ position: at(-60, 0), note: 'Too far' }];
    expect(issuePaths(route)).toEqual(['landmarks.0.position']);
  });

  it('rejects more than 20 landmarks', () => {
    const route = validRoute();
    route.landmarks = Array.from({ length: 21 }, (_, i) => ({ position: at(0, i * 5), note: 'x' }));
    expect(issuePaths(route)).toContain('landmarks');
  });

  it('rejects empty or overlong notes and overlong titles', () => {
    const blank = { ...validRoute(), landmarks: [{ position: at(5, 100), note: '   ' }] };
    expect(issuePaths(blank)).toEqual(['landmarks.0.note']);
    const long = { ...validRoute(), landmarks: [{ position: at(5, 100), note: 'a'.repeat(201) }] };
    expect(issuePaths(long)).toEqual(['landmarks.0.note']);
    expect(issuePaths({ ...validRoute(), title: 'a'.repeat(121) })).toEqual(['title']);
  });

  it('rejects coordinates out of range or not numbers', () => {
    expect(issuePaths({ ...validRoute(), door: { lat: 91, lng: 73 } })).toContain('door.lat');
    expect(issuePaths({ ...validRoute(), door: { lat: '33.6', lng: 73 } })).toContain('door.lat');
    expect(issuePaths({ ...validRoute(), door: { lat: Infinity, lng: 73 } })).toContain('door.lat');
  });
});

describe('response schemas', () => {
  const id = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';

  it('accepts a saved route', () => {
    const saved = {
      id,
      title: null,
      door: at(60, 210),
      path: [at(0, 0), at(50, 200)],
      lengthM: 206.2,
      landmarks: [{ id, position: at(5, 100), note: 'Green gate', alongM: 100 }],
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T15:00:00+05:00',
    };
    expect(DrawnRoute.safeParse(saved).success).toBe(true);
  });

  it('accepts only a 22-character base64url owner token', () => {
    expect(CreatedDrawnRoute.safeParse({ routeId: id, ownerToken: 'a'.repeat(22) }).success).toBe(
      true,
    );
    expect(CreatedDrawnRoute.safeParse({ routeId: id, ownerToken: 'a'.repeat(21) }).success).toBe(
      false,
    );
    expect(
      CreatedDrawnRoute.safeParse({ routeId: id, ownerToken: `${'a'.repeat(21)}+` }).success,
    ).toBe(false);
  });
});
