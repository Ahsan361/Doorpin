import { describe, expect, it } from 'vitest';
import { prepareTestDatabase, testDatabaseUrl } from './test-database-setup.ts';

describe('testDatabaseUrl', () => {
  it('keeps the server and user but switches to doorpin_test', () => {
    expect(testDatabaseUrl('postgres://doorpin:secret@127.0.0.1:5433/doorpin')).toBe(
      'postgres://doorpin:secret@127.0.0.1:5433/doorpin_test',
    );
  });
});

describe('prepareTestDatabase', () => {
  it('refuses a database whose name does not end in _test', async () => {
    await expect(
      prepareTestDatabase('postgres://doorpin:secret@127.0.0.1:5433/doorpin', '.'),
    ).rejects.toThrow(/must end in _test/);
  });
});
