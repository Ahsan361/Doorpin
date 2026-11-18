import { z } from 'zod';

/**
 * Body of every error response: `{ error: { code, message } }`.
 * Validation errors (400) also list what was wrong in `details`, e.g. `{ path: "landmarks.2.note", message: "..." }`.
 */
export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
