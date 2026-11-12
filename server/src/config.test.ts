import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

const validEnv = {
  DATABASE_URL: 'postgres://user:pass@127.0.0.1:5433/doorpin',
  REDIS_URL: 'redis://127.0.0.1:6380',
};

describe('loadConfig', () => {
  it('reads valid settings and applies defaults', () => {
    expect(loadConfig(validEnv)).toEqual({
      databaseUrl: validEnv.DATABASE_URL,
      redisUrl: validEnv.REDIS_URL,
      host: '127.0.0.1',
      port: 3000,
    });
  });

  it('rejects a missing database URL', () => {
    expect(() => loadConfig({ REDIS_URL: validEnv.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it('rejects a database URL with the wrong protocol', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: 'http://example.com' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
