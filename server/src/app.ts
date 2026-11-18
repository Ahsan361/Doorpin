import type { IncomingMessage, ServerResponse } from 'node:http';
import express, { type Express } from 'express';
import { pino, type Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Sql } from 'postgres';
import { drawnRoutesRouter } from './drawn-routes/router.ts';
import { errorHandler, notFound } from './errors.ts';
import { healthRouter, type HealthCheck } from './health.ts';

export type { HealthCheck } from './health.ts';

export interface AppDeps {
  /** The database connection pool. */
  sql: Sql;
  checkDatabase: HealthCheck;
  checkRedis: HealthCheck;
  /** How long a single health check may take before it counts as failed. */
  checkTimeoutMs?: number;
  /** Where request logs go. Silent when not given, which suits tests. */
  logger?: Logger;
}

const DEFAULT_CHECK_TIMEOUT_MS = 1500;

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    // Type arguments spelled out: without them TypeScript infers custom log levels we don't use.
    pinoHttp<IncomingMessage, ServerResponse, never>({
      logger: deps.logger ?? pino({ level: 'silent' }),
      // Tokens must never reach the logs.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use(
    '/api/v1',
    healthRouter({
      checkDatabase: deps.checkDatabase,
      checkRedis: deps.checkRedis,
      timeoutMs: deps.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS,
    }),
  );
  app.use('/api/v1/routes', drawnRoutesRouter(deps.sql));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
