import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  // Read VITE_* variables from the repo root .env, shared with the API.
  envDir: '../',
  server: { port: 5173, strictPort: true },
});
