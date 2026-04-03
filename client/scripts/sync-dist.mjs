import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(scriptDir, '..');
const distDir = resolve(clientDir, 'dist');
const staticDir = resolve(clientDir, '..', 'static');

if (!existsSync(distDir)) {
  console.error(`[sync-dist] Missing dist directory: ${distDir}`);
  process.exit(1);
}

rmSync(staticDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(distDir, staticDir, { recursive: true });
console.log(`[sync-dist] Copied ${distDir} -> ${staticDir}`);
