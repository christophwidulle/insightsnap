import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'InsightSnap',
  version: pkg.version,
  description: pkg.description,
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'InsightSnap',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['activeTab', 'storage', 'scripting'],
  host_permissions: ['<all_urls>'],
});
