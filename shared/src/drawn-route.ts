import { z } from 'zod';
import { distanceM, distanceToPathM, LatLng, pathLengthM } from './geo.ts';

/** Limits on a drawn route. The web app and the server both check them through DrawnRouteInput. */
export const DRAWN_ROUTE_LIMITS = {
  minPathPoints: 2,
  maxPathPoints: 500,
  maxPathLengthM: 5000,
  /** How far the door may be from the house end of the path (houses are often set back from the road). */
  maxDoorToPathEndM: 100,
  maxLandmarks: 20,
  maxLandmarkToPathM: 30,
  maxNoteChars: 200,
  maxTitleChars: 120,
} as const;

const L = DRAWN_ROUTE_LIMITS;

export const LandmarkInput = z.object({
  position: LatLng,
  /** For example "Turn left after the green gate". */
  note: z.string().trim().min(1).max(L.maxNoteChars),
});
export type LandmarkInput = z.infer<typeof LandmarkInput>;

/**
 * What the sender's app sends to create or replace a drawn route.
 *
 * `path` is in the rider's order of travel: `path[0]` is the entry point (where road directions end,
 * for example the society gate) and the last point is the road in front of the house. The sender
 * draws it the other way round; the app reverses it before sending.
 */
export const DrawnRouteInput = z
  .object({
    title: z.string().trim().max(L.maxTitleChars).optional(),
    door: LatLng,
    path: z.array(LatLng).min(L.minPathPoints).max(L.maxPathPoints),
    landmarks: z.array(LandmarkInput).max(L.maxLandmarks),
  })
  .superRefine((route, ctx) => {
    const houseEnd = route.path.at(-1);
    if (houseEnd === undefined) return;

    if (pathLengthM(route.path) > L.maxPathLengthM) {
      ctx.addIssue({
        code: 'custom',
        path: ['path'],
        message: `The path must be at most ${L.maxPathLengthM / 1000} km long.`,
      });
    }

    if (distanceM(route.door, houseEnd) > L.maxDoorToPathEndM) {
      ctx.addIssue({
        code: 'custom',
        path: ['door'],
        message: `The door must be within ${L.maxDoorToPathEndM} m of the house end of the path.`,
      });
    }

    route.landmarks.forEach((landmark, i) => {
      if (distanceToPathM(landmark.position, route.path) > L.maxLandmarkToPathM) {
        ctx.addIssue({
          code: 'custom',
          path: ['landmarks', i, 'position'],
          message: `Each landmark must be within ${L.maxLandmarkToPathM} m of the path.`,
        });
      }
    });
  });
export type DrawnRouteInput = z.infer<typeof DrawnRouteInput>;

/** A saved landmark. `alongM` is its distance from the entry point along the path. */
export const Landmark = z.object({
  id: z.uuid(),
  position: LatLng,
  note: z.string(),
  alongM: z.number(),
});
export type Landmark = z.infer<typeof Landmark>;

/** A saved drawn route, as the server returns it. Never contains the owner token. */
export const DrawnRoute = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  door: LatLng,
  /** Rider's order: entry point first, house end last. */
  path: z.array(LatLng),
  lengthM: z.number(),
  /** Sorted by `alongM`, entry point first. */
  landmarks: z.array(Landmark),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type DrawnRoute = z.infer<typeof DrawnRoute>;

/** The secret in the sender's edit link: 128 random bits, base64url-encoded (22 characters). */
export const OwnerToken = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

/** Response of POST /api/v1/routes. The owner token is shown this once; the server keeps only its hash. */
export const CreatedDrawnRoute = z.object({
  routeId: z.uuid(),
  ownerToken: OwnerToken,
});
export type CreatedDrawnRoute = z.infer<typeof CreatedDrawnRoute>;
