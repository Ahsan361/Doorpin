import postgres, { type Sql } from 'postgres';
import { inject } from 'vitest';

/** Connects a test to the migrated `doorpin_test` database. Call `sql.end()` in `afterAll`. */
export function connectTestDatabase(): Sql {
  return postgres(inject('testDatabaseUrl'), { max: 2, onnotice: () => {} });
}
