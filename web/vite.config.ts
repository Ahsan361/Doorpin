import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';

// The repo root, where the .env shared with the server lives. Worked out from this file's
// location so it is right whichever folder Vite is started from.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  // VITE_* variables reach the browser; API_HOST and API_PORT are read here only, to proxy
  // /api to the local server. The defaults match server/src/config.ts.
  const env = loadEnv(mode, repoRoot, '');
  const apiTarget = `http://${env.API_HOST || '127.0.0.1'}:${env.API_PORT || '3000'}`;

  return {
    plugins: [svelte()],
    envDir: repoRoot,
    server: {
      port: 5173,
      strictPort: true,
      // In development the web app and the server run on different ports; the proxy makes
      // /api calls same-origin, as they will be in production.
      proxy: { '/api': apiTarget },
    },
  };
});
