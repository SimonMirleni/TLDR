import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

const googleClientId = getEnv('WXT_GOOGLE_CLIENT_ID');

function getEnv(name: string): string {
  if (process.env[name]) return process.env[name];

  const configDir = dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = resolve(configDir, '..', '.env');
  if (!existsSync(rootEnvPath)) return '';

  const prefix = `${name}=`;
  const line = readFileSync(rootEnvPath, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(prefix));
  return (
    line
      ?.slice(prefix.length)
      .trim()
      .replace(/\s+#.*$/, '')
      .replace(/^['"]|['"]$/g, '') ?? ''
  );
}

// WXT auto-discovers entrypoints under src/entrypoints/. Manifest is composed from
// this config + per-entrypoint metadata.
export default defineConfig({
  srcDir: 'src',
  // Load .env from the monorepo root (one level up) so the extension and
  // backend share a single env file. Without this, WXT/Vite reads from the
  // extension package directory and the WXT_* vars come back empty.
  vite: () => ({
    envDir: '..',
  }),
  manifest: {
    name: 'TLDR',
    description: 'Save pages, summarize the queue into one email on demand.',
    version: '0.0.1',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'TLDR',
    },
    permissions: ['identity', 'activeTab', 'scripting', 'storage', 'tabs', 'readingList', 'alarms'],
    oauth2: {
      client_id: googleClientId,
      scopes: ['openid', 'email', 'profile'],
    },
    host_permissions: ['<all_urls>'],
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
    // `key` locks the extension ID across unpacked reloads so the OAuth client ID
    // registered in Google Cloud keeps matching. Generate one with:
    //   openssl rand -base64 1024 | tr -d '\n' | tr '+/' '-_' | cut -c1-1024
    // Then paste the resulting public key here (NOT the private key).
    // Without this line, the extension ID changes every reload.
    // key: '<your-public-key>',
  },
});
