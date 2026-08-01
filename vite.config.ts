import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  // ponytail: no sourcemaps in the prod build — they end up as web_accessible_resources
  // in the manifest and bloat the release zip. The dev server still serves inline maps.
  build: {
    target: 'esnext',
  },
});
