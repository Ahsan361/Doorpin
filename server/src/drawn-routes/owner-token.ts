import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { OwnerToken } from '@doorpin/shared';

/** A new secret for a sender's edit link: 128 random bits, plus the hash that is stored instead of it. */
export function createOwnerToken(): { token: string; hash: string } {
  const token = randomBytes(16).toString('base64url');
  return { token, hash: hashOwnerToken(token) };
}

/** SHA-256 of a token, as 64 hex characters. Only this is stored. */
export function hashOwnerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The token from an `Authorization: Bearer <token>` header, or undefined if the header is missing or malformed. */
export function ownerTokenFromHeader(header: string | undefined): string | undefined {
  const match = /^Bearer (\S+)$/i.exec(header ?? '');
  const parsed = OwnerToken.safeParse(match?.[1]);
  return parsed.success ? parsed.data : undefined;
}

// Compared against when the route doesn't exist, so an unknown route takes as long as a wrong token.
const NO_ROUTE_HASH = '0'.repeat(64);

/** Constant-time check of a presented token against the stored hash (undefined when the route doesn't exist). */
export function ownerTokenMatches(token: string, storedHash: string | undefined): boolean {
  const presented = Buffer.from(hashOwnerToken(token), 'hex');
  const stored = Buffer.from(storedHash ?? NO_ROUTE_HASH, 'hex');
  const equal = presented.length === stored.length && timingSafeEqual(presented, stored);
  return equal && storedHash !== undefined;
}
