import type { CheckStatus, HealthResponse } from '@doorpin/shared';
import { Router } from 'express';

/** Resolves when a dependency is reachable, rejects otherwise. */
export type HealthCheck = () => Promise<unknown>;

export interface HealthChecks {
  checkDatabase: HealthCheck;
  checkRedis: HealthCheck;
  /** How long a single check may take before it counts as failed. */
  timeoutMs: number;
}

/** Runs one check with a time limit. Returns the failure reason, or null when it passed. */
async function runCheck(check: HealthCheck, timeoutMs: number): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    await Promise.race([check(), timeout]);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }
}

export function healthRouter({ checkDatabase, checkRedis, timeoutMs }: HealthChecks): Router {
  const router = Router();

  router.get('/healthz', async (req, res) => {
    const [databaseFailure, redisFailure] = await Promise.all([
      runCheck(checkDatabase, timeoutMs),
      runCheck(checkRedis, timeoutMs),
    ]);
    if (databaseFailure)
      req.log.warn({ check: 'database', reason: databaseFailure }, 'health check failed');
    if (redisFailure) req.log.warn({ check: 'redis', reason: redisFailure }, 'health check failed');

    const database: CheckStatus = databaseFailure ? 'error' : 'ok';
    const redis: CheckStatus = redisFailure ? 'error' : 'ok';
    const body: HealthResponse = {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'error',
      checks: { database, redis },
    };
    res.status(body.status === 'ok' ? 200 : 503).json(body);
  });

  return router;
}
