import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Sql } from 'postgres';

const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

/** Keeps only migration files (`0001_name.sql`) and sorts them in the order they must run. */
export function selectMigrationFiles(fileNames: string[]): string[] {
  return fileNames.filter((name) => MIGRATION_FILE.test(name)).sort();
}

/** Content hash of a migration, ignoring Windows vs Unix line endings. */
export function migrationChecksum(sqlText: string): string {
  return createHash('sha256').update(sqlText.replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * Applies every migration in `dir` that has not run yet, each in its own transaction.
 * Returns the names of the migrations applied by this call.
 * Throws if an already-applied migration file has been changed.
 */
export async function migrate(sql: Sql, dir: string): Promise<string[]> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  const rows = await sql<{ name: string; checksum: string }[]>`
    SELECT name, checksum FROM schema_migrations
  `;
  const applied = new Map(rows.map((row) => [row.name, row.checksum]));
  const appliedNow: string[] = [];

  for (const name of selectMigrationFiles(await readdir(dir))) {
    const sqlText = await readFile(join(dir, name), 'utf8');
    const checksum = migrationChecksum(sqlText);
    const previous = applied.get(name);
    if (previous !== undefined) {
      if (previous !== checksum) {
        throw new Error(
          `Migration ${name} was changed after it was applied. Add a new migration instead.`,
        );
      }
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
      await tx`INSERT INTO schema_migrations (name, checksum) VALUES (${name}, ${checksum})`;
    });
    appliedNow.push(name);
  }
  return appliedNow;
}
