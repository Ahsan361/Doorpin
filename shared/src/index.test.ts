import { describe, expect, it } from 'vitest';
import { HealthResponse } from './index.ts';

describe('HealthResponse', () => {
  it('accepts a valid health body', () => {
    const body = { status: 'ok', checks: { database: 'ok', redis: 'error' } };
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it('rejects an unknown status', () => {
    const body = { status: 'degraded', checks: { database: 'ok', redis: 'ok' } };
    expect(HealthResponse.safeParse(body).success).toBe(false);
  });
});
