import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extRoot = resolve(here, '..');
const repoRoot = resolve(extRoot, '../..');
const src = join(repoRoot, 'packages/elsa-to-mermaid/wasm-node');
const dst = join(extRoot, 'dist/wasm');

if (!existsSync(src)) {
  console.error(`✗ wasm-node not found at ${src}`);
  console.error('  Run `make wasm-node` from the elsa-to-mermaid root first.');
  process.exit(1);
}

await rm(dst, { recursive: true, force: true });
await mkdir(dst, { recursive: true });
await cp(src, dst, { recursive: true });

const files = await readdir(dst);
console.log(`✓ Copied wasm-node → dist/wasm/ (${files.length} files)`);
