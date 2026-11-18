import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createOwnerToken,
  hashOwnerToken,
  ownerTokenFromHeader,
  ownerTokenMatches,
} from './owner-token.ts';

describe('owner tokens', () => {
  it('creates a 22-character base64url token (128 bits) and its SHA-256 hash', () => {
    const { token, hash } = createOwnerToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).not.toContain(token);
  });

  it('creates a different token every time', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createOwnerToken().token));
    expect(tokens.size).toBe(100);
  });

  it('reads the token from a Bearer header and ignores anything malformed', () => {
    const { token } = createOwnerToken();
    expect(ownerTokenFromHeader(`Bearer ${token}`)).toBe(token);
    expect(ownerTokenFromHeader(`bearer ${token}`)).toBe(token);
    expect(ownerTokenFromHeader(undefined)).toBeUndefined();
    expect(ownerTokenFromHeader(token)).toBeUndefined();
    expect(ownerTokenFromHeader(`Basic ${token}`)).toBeUndefined();
    expect(ownerTokenFromHeader(`Bearer ${token}x`)).toBeUndefined();
    expect(ownerTokenFromHeader(`Bearer  ${token}`)).toBeUndefined();
  });

  it('matches only the right token against the stored hash', () => {
    const { token, hash } = createOwnerToken();
    expect(ownerTokenMatches(token, hash)).toBe(true);
    expect(ownerTokenMatches(createOwnerToken().token, hash)).toBe(false);
    expect(ownerTokenMatches(token, undefined)).toBe(false);
    expect(ownerTokenMatches(token, hashOwnerToken('something else'))).toBe(false);
  });
});
