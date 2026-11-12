import express from 'express';
import { pinoHttp } from 'pino-http';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { errorHandler } from './errors.ts';
import { listen } from './test-server.ts';

/** A tiny app whose only route throws the given error. */
async function requestThrowing(error: unknown) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.get('/boom', async () => {
    throw error;
  });
  app.use(errorHandler);

  const server = await listen(app);
  try {
    const response = await fetch(`${server.url}/boom`);
    return { status: response.status, text: await response.text() };
  } finally {
    await server.close();
  }
}

describe('errorHandler', () => {
  it('turns an unexpected error into a generic 500 without internal details', async () => {
    const { status, text } = await requestThrowing(new Error('database password is hunter2'));
    expect(status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' },
    });
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('at ');
  });

  it('keeps the status of client errors', async () => {
    const { status, text } = await requestThrowing(
      Object.assign(new Error('nope'), { status: 405 }),
    );
    expect(status).toBe(405);
    expect(JSON.parse(text)).toEqual({
      error: { code: 'BAD_REQUEST', message: 'The request could not be processed.' },
    });
  });
});
