#!/usr/bin/env node
// Mirrors LICENSE.md from the workspace root into every publishable package
// directory that npm / vsce need a local copy in. The Rust crates inherit via
// `license-file.workspace = true` and do not need duplicates.
//
// Run this whenever LICENSE.md at the root changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const TARGETS = [
  'packages/elsa-to-mermaid/LICENSE.md',
  'packages/elsa-to-mermaid-cli/LICENSE.md',
  'apps/vscode-extension/LICENSE.md',
];

const source = readFileSync(join(REPO_ROOT, 'LICENSE.md'), 'utf8');
for (const rel of TARGETS) {
  writeFileSync(join(REPO_ROOT, rel), source);
  console.log(`✓ ${rel}`);
}
console.log(`\nMirrored LICENSE.md → ${TARGETS.length} package(s).`);
