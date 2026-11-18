import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Creates and migrates the doorpin_test database once before the tests (needs `npm run db:up`).
    globalSetup: ['./src/db/test-database-setup.ts'],
    // Database tests clear shared tables, so test files run one at a time.
    fileParallelism: false,
  },
});
