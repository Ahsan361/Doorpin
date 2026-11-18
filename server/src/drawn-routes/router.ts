import { CreatedDrawnRoute, DrawnRoute, DrawnRouteInput } from '@doorpin/shared';
import { Router, type Request, type Response } from 'express';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { errorBody } from '../errors.ts';
import { createOwnerToken, ownerTokenFromHeader, ownerTokenMatches } from './owner-token.ts';
import {
  findDrawnRoute,
  findOwnerTokenHash,
  insertDrawnRoute,
  replaceDrawnRoute,
} from './store.ts';

const RouteId = z.uuid();

/**
 * The route id, if the request carries this route's owner token; otherwise undefined.
 * An unknown id, a malformed id and a missing or wrong token all look the same to the caller.
 */
async function ownedRouteId(sql: Sql, req: Request): Promise<string | undefined> {
  const id = RouteId.safeParse(req.params.id);
  const token = ownerTokenFromHeader(req.get('authorization'));
  if (!id.success || token === undefined) return undefined;
  const storedHash = await findOwnerTokenHash(sql, id.data);
  return ownerTokenMatches(token, storedHash) ? id.data : undefined;
}

function sendRouteNotFound(res: Response): void {
  res.status(404).json(errorBody('ROUTE_NOT_FOUND', 'No such route, or the edit link is wrong.'));
}

function sendInvalidRoute(res: Response, error: z.ZodError): void {
  const details = error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  res.status(400).json(errorBody('INVALID_ROUTE', 'The route is not valid.', details));
}

/** POST /routes, GET /routes/:id and PUT /routes/:id. Mounted under /api/v1. */
export function drawnRoutesRouter(sql: Sql): Router {
  const router = Router();

  // Responses carry a route or its secret token; no cache should keep them.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/', async (req, res) => {
    const input = DrawnRouteInput.safeParse(req.body);
    if (!input.success) {
      sendInvalidRoute(res, input.error);
      return;
    }
    const { token, hash } = createOwnerToken();
    const routeId = await insertDrawnRoute(sql, input.data, hash);
    res.status(201).json(CreatedDrawnRoute.parse({ routeId, ownerToken: token }));
  });

  router.get('/:id', async (req, res) => {
    const id = await ownedRouteId(sql, req);
    const route = id === undefined ? undefined : await findDrawnRoute(sql, id);
    if (route === undefined) {
      sendRouteNotFound(res);
      return;
    }
    res.json(DrawnRoute.parse(route));
  });

  router.put('/:id', async (req, res) => {
    // The token is checked before the route is validated, so a caller without it never learns
    // anything about the route. (Malformed or oversized JSON is refused earlier, by express.json,
    // with the same 400 or 413 for every id, so that reveals nothing either.)
    const id = await ownedRouteId(sql, req);
    if (id === undefined) {
      sendRouteNotFound(res);
      return;
    }
    const input = DrawnRouteInput.safeParse(req.body);
    if (!input.success) {
      sendInvalidRoute(res, input.error);
      return;
    }
    const replaced = await replaceDrawnRoute(sql, id, input.data);
    const route = replaced ? await findDrawnRoute(sql, id) : undefined;
    if (route === undefined) {
      sendRouteNotFound(res);
      return;
    }
    res.json(DrawnRoute.parse(route));
  });

  return router;
}
