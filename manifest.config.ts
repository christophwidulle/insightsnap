import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

// Generated from assets/icon.svg by `npm run icons`, checked in so the build
// runs without macOS (sips) available.
const ICONS = {
  16: 'icons/16.png',
  32: 'icons/32.png',
  48: 'icons/48.png',
  128: 'icons/128.png',
};

export default defineManifest({
  manifest_version: 3,
  name: 'InsightSnap',
  version: pkg.version,
  description: pkg.description,
  icons: ICONS,
  action: {
    default_title: 'InsightSnap – Einstellungen öffnen',
    default_icon: ICONS,
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      js: ['src/content/youtube.tsx'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage'],
  // ponytail: broad host permission because the OpenAI-compatible base URL is
  // user-configurable — any host must be fetchable from the service worker (CORS).
  host_permissions: ['https://*/*'],
});
