import { describe, expect, it } from 'vitest';
import { migrationChecksum, selectMigrationFiles } from './migrate.ts';

describe('selectMigrationFiles', () => {
  it('keeps numbered .sql files and sorts them', () => {
    expect(
      selectMigrationFiles(['0002_routes.sql', 'README.md', '0001_enable_postgis.sql', 'x.sql']),
    ).toEqual(['0001_enable_postgis.sql', '0002_routes.sql']);
  });
});

describe('migrationChecksum', () => {
  it('ignores Windows line endings', () => {
    expect(migrationChecksum('SELECT 1;\r\nSELECT 2;\r\n')).toBe(
      migrationChecksum('SELECT 1;\nSELECT 2;\n'),
    );
  });

  it('changes when the SQL changes', () => {
    expect(migrationChecksum('SELECT 1;')).not.toBe(migrationChecksum('SELECT 2;'));
  });
});
