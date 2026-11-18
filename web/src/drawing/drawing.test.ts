import type { DrawnRoute, LatLng } from '@doorpin/shared';
import { describe, expect, it } from 'vitest';
import {
  addLandmark,
  addPoint,
  clearPath,
  doorDistance,
  emptyDrawing,
  fromSavedRoute,
  isNearPath,
  pathLength,
  removeLandmark,
  routeProblems,
  setDoor,
  setTitle,
  toRouteInput,
  undoPoint,
  updateLandmarkNote,
  type Drawing,
} from './drawing.ts';

/** A point `northM` meters north and `eastM` meters east of a spot in Islamabad. */
function at(northM: number, eastM: number): LatLng {
  const lat = 33.66;
  return {
    lat: lat + northM / 111_320,
    lng: 73.08 + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

/** Door at (60, 210); the sender taps from the house end (50, 200) out to the gate (0, 0). */
function drawn(): Drawing {
  let drawing = setDoor(emptyDrawing(), at(60, 210));
  for (const point of [at(50, 200), at(0, 200), at(0, 0)]) drawing = addPoint(drawing, point);
  return drawing;
}

describe('drawing a path', () => {
  it('adds points in tapping order and undoes the last one', () => {
    const drawing = drawn();
    expect(drawing.points).toEqual([at(50, 200), at(0, 200), at(0, 0)]);
    expect(undoPoint(drawing).points).toEqual([at(50, 200), at(0, 200)]);
    expect(undoPoint(emptyDrawing()).points).toEqual([]);
  });

  it('does not change the drawing it was given', () => {
    const drawing = drawn();
    undoPoint(drawing);
    addPoint(drawing, at(5, 5));
    expect(drawing.points).toHaveLength(3);
  });

  it('stops adding points at 500', () => {
    let drawing = emptyDrawing();
    for (let i = 0; i < 505; i++) drawing = addPoint(drawing, at(0, i));
    expect(drawing.points).toHaveLength(500);
  });

  it('clears the path and its landmarks but keeps the door', () => {
    const drawing = addLandmark(drawn(), { position: at(2, 100), note: 'Gate' });
    const cleared = clearPath(drawing);
    expect(cleared.points).toEqual([]);
    expect(cleared.landmarks).toEqual([]);
    expect(cleared.door).toEqual(at(60, 210));
  });

  it('measures the path and how far the door is from where it starts', () => {
    expect(pathLength(drawn())).toBeCloseTo(250, 0);
    expect(doorDistance(drawn())).toBeCloseTo(14.1, 0);
    expect(doorDistance(emptyDrawing())).toBeNull();
  });
});

describe('landmarks', () => {
  it('knows whether a spot is within 30 m of the path', () => {
    expect(isNearPath(drawn(), at(20, 100))).toBe(true);
    expect(isNearPath(drawn(), at(40, 100))).toBe(false);
    expect(isNearPath(emptyDrawing(), at(0, 0))).toBe(false);
  });

  it('adds, edits and removes landmarks, up to 20', () => {
    let drawing = addLandmark(drawn(), { position: at(2, 100), note: 'Gate' });
    drawing = addLandmark(drawing, { position: at(2, 150), note: 'Mosque' });
    drawing = updateLandmarkNote(drawing, 0, 'Green gate');
    drawing = removeLandmark(drawing, 1);
    expect(drawing.landmarks).toEqual([{ position: at(2, 100), note: 'Green gate' }]);

    for (let i = 0; i < 25; i++) drawing = addLandmark(drawing, { position: at(0, i), note: 'x' });
    expect(drawing.landmarks).toHaveLength(20);
  });
});

describe('saving', () => {
  it('reverses the path into the rider order: entry point first, house end last', () => {
    const input = toRouteInput(setTitle(drawn(), 'Home')) as { path: LatLng[]; title: string };
    expect(input.path).toEqual([at(0, 0), at(0, 200), at(50, 200)]);
    expect(input.title).toBe('Home');
  });

  it('has no problems when the drawing is complete', () => {
    expect(routeProblems(drawn())).toEqual([]);
  });

  it('reports what stops saving, using the shared limits', () => {
    expect(routeProblems(emptyDrawing()).map((problem) => problem.path)).toEqual(['door', 'path']);
    const farDoor = setDoor(drawn(), at(300, 300));
    expect(routeProblems(farDoor)).toEqual([
      { path: 'door', message: 'The door must be within 100 m of the house end of the path.' },
    ]);
    const farLandmark = addLandmark(drawn(), { position: at(-80, 100), note: 'Too far' });
    expect(routeProblems(farLandmark).map((problem) => problem.path)).toEqual([
      'landmarks.0.position',
    ]);
    // About 6 km: tapped from the house end (50, 200) far out to the west.
    const tooLong = addPoint(drawn(), at(0, -5800));
    expect(routeProblems(tooLong).map((problem) => problem.path)).toEqual(['path']);
  });

  it('turns a saved route back into the same drawing', () => {
    const drawing = addLandmark(setTitle(drawn(), 'Home'), { position: at(2, 100), note: 'Gate' });
    const input = toRouteInput(drawing) as Pick<DrawnRoute, 'title' | 'door' | 'path'>;
    const saved: DrawnRoute = {
      ...input,
      id: '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90',
      lengthM: 250,
      landmarks: [
        {
          id: '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b91',
          position: at(2, 100),
          note: 'Gate',
          alongM: 100,
        },
      ],
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
    };
    expect(fromSavedRoute(saved)).toEqual(drawing);
    expect(fromSavedRoute({ ...saved, title: null }).title).toBe('');
  });
});
