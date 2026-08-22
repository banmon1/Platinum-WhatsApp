import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

function findServerRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, '..'), resolve(here, '../..'), resolve(process.cwd())]) {
    const packageFile = resolve(candidate, 'package.json');
    if (!existsSync(packageFile)) continue;
    try {
      if (JSON.parse(readFileSync(packageFile, 'utf8')).name === '@platinum/server') return candidate;
    } catch { /* keep looking */ }
  }
  return resolve(process.cwd(), 'apps/server');
}

export const serverRoot = findServerRoot();
dotenv.config({ path: resolve(serverRoot, '.env') });

export const dataDir = resolve(serverRoot, 'data');
export const authDir = resolve(dataDir, 'whatsapp-auth');
export const databasePath = resolve(dataDir, 'platinum.sqlite');
export const secretPath = resolve(dataDir, 'nabilo-secret.key');
export const port = Number(process.env.PORT || 8787);
export const clientOrigin = process.env.CLIENT_ORIGIN || '*';

mkdirSync(dataDir, { recursive: true });
