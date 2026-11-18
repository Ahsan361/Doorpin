import {
  DRAWN_ROUTE_LIMITS,
  DrawnRouteInput,
  distanceM,
  distanceToPathM,
  pathLengthM,
  type DrawnRoute,
  type LatLng,
} from '@doorpin/shared';

export interface LandmarkDraft {
  position: LatLng;
  note: string;
}

/**
 * What the sender has drawn so far. Plain data: every change returns a new Drawing.
 *
 * `points` are in the order the sender taps them: from the road in front of the house outward
 * to the entry point. The server wants the opposite (the rider's order), see `toRouteInput`.
 */
export interface Drawing {
  title: string;
  door: LatLng | null;
  points: LatLng[];
  landmarks: LandmarkDraft[];
}

export interface Problem {
  /** Which part is wrong, e.g. "door" or "landmarks.2.note"; empty for the route as a whole. */
  path: string;
  message: string;
}

/** Below this map zoom one pixel covers too much ground to place a point; a tap zooms in instead. */
export const MIN_TAP_ZOOM = 16;

/** Whether a tap at this zoom places a point (rather than zooming in to that spot). */
export function tapPlacesPoint(zoom: number): boolean {
  return zoom >= MIN_TAP_ZOOM;
}

export function emptyDrawing(): Drawing {
  return { title: '', door: null, points: [], landmarks: [] };
}

export function setDoor(drawing: Drawing, door: LatLng): Drawing {
  return { ...drawing, door };
}

export function setTitle(drawing: Drawing, title: string): Drawing {
  return { ...drawing, title };
}

/** Adds the next tapped point. Ignored once the path has the most points allowed. */
export function addPoint(drawing: Drawing, point: LatLng): Drawing {
  if (drawing.points.length >= DRAWN_ROUTE_LIMITS.maxPathPoints) return drawing;
  return { ...drawing, points: [...drawing.points, point] };
}

/** Removes the last tapped point. */
export function undoPoint(drawing: Drawing): Drawing {
  return { ...drawing, points: drawing.points.slice(0, -1) };
}

/** Starts the path again. Landmarks go too, since they belong to the path. The door stays. */
export function clearPath(drawing: Drawing): Drawing {
  return { ...drawing, points: [], landmarks: [] };
}

/** True when a landmark at this spot would be close enough to the path to be accepted. */
export function isNearPath(drawing: Drawing, position: LatLng): boolean {
  return distanceToPathM(position, drawing.points) <= DRAWN_ROUTE_LIMITS.maxLandmarkToPathM;
}

/** Adds a landmark. Ignored once the route has the most landmarks allowed. */
export function addLandmark(drawing: Drawing, landmark: LandmarkDraft): Drawing {
  if (drawing.landmarks.length >= DRAWN_ROUTE_LIMITS.maxLandmarks) return drawing;
  return { ...drawing, landmarks: [...drawing.landmarks, landmark] };
}

export function updateLandmarkNote(drawing: Drawing, index: number, note: string): Drawing {
  return {
    ...drawing,
    landmarks: drawing.landmarks.map((landmark, i) =>
      i === index ? { ...landmark, note } : landmark,
    ),
  };
}

export function removeLandmark(drawing: Drawing, index: number): Drawing {
  return { ...drawing, landmarks: drawing.landmarks.filter((_, i) => i !== index) };
}

/** Length of the drawn path so far, in meters. */
export function pathLength(drawing: Drawing): number {
  return pathLengthM(drawing.points);
}

/** How far the door is from where the path starts (the road in front of the house), in meters. */
export function doorDistance(drawing: Drawing): number | null {
  const [houseEnd] = drawing.points;
  return drawing.door === null || houseEnd === undefined ? null : distanceM(drawing.door, houseEnd);
}

/** The request body for saving: the path reversed into the rider's order (entry point first). */
export function toRouteInput(drawing: Drawing): unknown {
  return {
    title: drawing.title,
    door: drawing.door,
    path: [...drawing.points].reverse(),
    landmarks: drawing.landmarks,
  };
}

/**
 * Everything that would stop the route from being saved, checked with the same shared schema
 * the server uses, so the app and the server can never disagree. Empty when it can be saved.
 */
export function routeProblems(drawing: Drawing): Problem[] {
  const result = DrawnRouteInput.safeParse(toRouteInput(drawing));
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Turns a saved route back into a drawing for the edit page (path back in the sender's order). */
export function fromSavedRoute(route: DrawnRoute): Drawing {
  return {
    title: route.title ?? '',
    door: route.door,
    points: [...route.path].reverse(),
    landmarks: route.landmarks.map(({ position, note }) => ({ position, note })),
  };
}
