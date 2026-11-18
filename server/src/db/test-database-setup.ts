import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';
import { migrate } from './migrate.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

const TEST_DATABASE = 'doorpin_test';
const SAFE_TEST_NAME = /^[a-z0-9_]+_test$/;

/** Same server and user as `databaseUrl`, but the `doorpin_test` database. */
export function testDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
}

/**
 * Creates the test database if it doesn't exist yet and applies all migrations to it.
 * Refuses any database whose name doesn't end in `_test`, so tests can never touch the dev database.
 */
export async function prepareTestDatabase(url: string, migrationsDir: string): Promise<void> {
  const parsed = new URL(url);
  const name = parsed.pathname.slice(1);
  if (!SAFE_TEST_NAME.test(name)) {
    throw new Error(
      `Refusing to run tests against "${name}": the database name must end in _test.`,
    );
  }

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const options = { max: 1, connect_timeout: 5, onnotice: () => {} };
  try {
    const adminSql = postgres(admin.toString(), options);
    try {
      const existing = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
      // The name was checked against SAFE_TEST_NAME above, so it is safe to put in the statement.
      if (existing.length === 0) await adminSql.unsafe(`CREATE DATABASE "${name}"`);
    } finally {
      await adminSql.end();
    }

    const sql = postgres(url, options);
    try {
      await migrate(sql, migrationsDir);
    } finally {
      await sql.end();
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not prepare the test database at ${parsed.host}. Is it running? Start it with \`npm run db:up\`. (${reason})`,
      { cause: err },
    );
  }
}

/** Vitest global setup: runs once before the server tests. */
export default async function setup(project: TestProject): Promise<void> {
  if (process.env.DATABASE_URL === undefined) {
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
    } catch {
      // No .env file; the check below explains what to do.
    }
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env (see README).');
  }

  const url = testDatabaseUrl(databaseUrl);
  await prepareTestDatabase(url, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  project.provide('testDatabaseUrl', url);
}
