import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'InsightSnap',
  version: pkg.version,
  description: pkg.description,
  action: {
    default_title: 'InsightSnap – Einstellungen öffnen',
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
