import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error.ts';

describe('ApiError', () => {
  it('accepts an error with or without details', () => {
    expect(
      ApiError.safeParse({ error: { code: 'NOT_FOUND', message: 'No such route.' } }).success,
    ).toBe(true);
    const invalid = {
      error: {
        code: 'INVALID_BODY',
        message: 'The route is not valid.',
        details: [{ path: 'landmarks.0.note', message: 'Too long.' }],
      },
    };
    expect(ApiError.safeParse(invalid).success).toBe(true);
  });

  it('rejects a body without a code', () => {
    expect(ApiError.safeParse({ error: { message: 'x' } }).success).toBe(false);
  });
});
