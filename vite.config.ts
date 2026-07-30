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
  // ponytail: keine Sourcemaps im Prod-Build — sie landen sonst als
  // web_accessible_resources im Manifest und blähen das Release-ZIP auf.
  // Dev-Server liefert weiterhin inline Maps.
  build: {
    target: 'esnext',
  },
});
