import { z } from 'zod';

export * from './api-error.ts';
export * from './drawn-route.ts';
export * from './geo.ts';

export const CheckStatus = z.enum(['ok', 'error']);
export type CheckStatus = z.infer<typeof CheckStatus>;

/** Response body of GET /api/v1/healthz. */
export const HealthResponse = z.object({
  status: CheckStatus,
  checks: z.object({
    database: CheckStatus,
    redis: CheckStatus,
  }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
