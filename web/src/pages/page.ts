import { OwnerToken, RouteId } from '@doorpin/shared';

/** Which screen the address shows. */
export type Page =
  | { name: 'create' }
  | { name: 'edit'; routeId: string; ownerToken: string }
  | { name: 'not-found' };

/**
 * Picks the page for an address: `/` creates a route, `/edit/<routeId>#<ownerToken>` edits one.
 * The owner token sits after `#`, so the browser never sends it to a server.
 * An edit link with a missing or malformed id or token is treated as not found.
 */
export function pageFor(pathname: string, hash: string): Page {
  if (pathname === '/') return { name: 'create' };

  const match = /^\/edit\/([^/]+)\/?$/.exec(pathname);
  if (match?.[1] !== undefined) {
    const routeId = RouteId.safeParse(match[1]);
    const ownerToken = OwnerToken.safeParse(hash.replace(/^#/, ''));
    if (routeId.success && ownerToken.success) {
      return { name: 'edit', routeId: routeId.data, ownerToken: ownerToken.data };
    }
  }
  return { name: 'not-found' };
}
