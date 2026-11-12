import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { loadConfig } from '../config.ts';
import { migrate } from './migrate.ts';

const migrationsDir = fileURLToPath(new URL('../../migrations/', import.meta.url));
const sql = postgres(loadConfig().databaseUrl, { max: 1, onnotice: () => {} });

try {
  const applied = await migrate(sql, migrationsDir);
  console.log(applied.length === 0 ? 'Database is up to date.' : `Applied: ${applied.join(', ')}`);
} catch (err) {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
