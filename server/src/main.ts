import { createServer } from 'node:http';
import { pino } from 'pino';
import postgres from 'postgres';
import { createClient } from 'redis';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const sql = postgres(config.databaseUrl, { max: 10, connect_timeout: 5, onnotice: () => {} });
// Fail Redis commands at once while disconnected, instead of queueing them.
const redis = createClient({ url: config.redisUrl, disableOfflineQueue: true });

// Log a Redis outage once, not on every reconnect attempt.
let redisDown = false;
redis.on('error', (err: Error) => {
  if (!redisDown) {
    redisDown = true;
    logger.warn({ reason: err.message }, 'redis unavailable, retrying in the background');
  }
});
redis.on('ready', () => {
  if (redisDown) logger.info('redis connection restored');
  redisDown = false;
});
redis.connect().catch(() => {
  // Reported by the 'error' handler above; the client keeps retrying.
});

const app = createApp({
  logger,
  sql,
  checkDatabase: () => sql`SELECT 1`,
  checkRedis: () => redis.ping(),
});

const server = createServer(app);

server.on('error', (err) => {
  logger.fatal({ err }, 'server could not start');
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  logger.info(`server listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await sql.end({ timeout: 5 });
  redis.destroy();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
