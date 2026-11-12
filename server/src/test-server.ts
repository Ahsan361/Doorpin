import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

/** Starts an app on a free local port for a test. Call `close()` when done. */
export async function listen(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
