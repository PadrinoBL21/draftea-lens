import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const candidates = [
  join(root, 'apps/web/dist/browser'),
  join(root, 'apps/web/dist/web/browser'),
  join(root, 'apps/web/dist/apps/web/browser'),
  join(root, 'apps/web/dist'),
];

function findIndexHtml(dir, depth = 0) {
  if (depth > 4 || !existsSync(dir)) return null;
  if (existsSync(join(dir, 'index.html'))) return dir;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const found = findIndexHtml(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const source = candidates.map((dir) => findIndexHtml(dir)).find(Boolean);
if (!source) {
  console.error('Could not locate Angular build output with index.html under apps/web/dist.');
  process.exit(1);
}

const target = '/tmp/draftea-lens-web-dist';
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`Copied web dist from ${source} to ${target}`);
