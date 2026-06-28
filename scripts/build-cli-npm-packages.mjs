#!/usr/bin/env node
// Builds the per-platform npm subpackages for elsa-to-mermaid-cli from a
// directory tree of CI-uploaded binaries.
//
// Layout expected at --binaries (default: artifacts/):
//   artifacts/cli-darwin-x64/elsa-to-mermaid
//   artifacts/cli-darwin-arm64/elsa-to-mermaid
//   artifacts/cli-linux-x64-gnu/elsa-to-mermaid
//   artifacts/cli-linux-arm64-gnu/elsa-to-mermaid
//   artifacts/cli-win32-x64-msvc/elsa-to-mermaid.exe
//
// Writes (default --out: dist/cli-npm/):
//   dist/cli-npm/elsa-to-mermaid-cli-darwin-x64/
//     package.json
//     bin/elsa-to-mermaid
//   …one directory per platform.
//
// The wrapper at packages/elsa-to-mermaid-cli/ is left untouched — it's
// published as-is from its source location.

import { mkdirSync, copyFileSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PLATFORMS = [
  { id: 'darwin-x64',      os: 'darwin', cpu: 'x64',   ext: '' },
  { id: 'darwin-arm64',    os: 'darwin', cpu: 'arm64', ext: '' },
  { id: 'linux-x64-gnu',   os: 'linux',  cpu: 'x64',   ext: '', libc: 'glibc' },
  { id: 'linux-arm64-gnu', os: 'linux',  cpu: 'arm64', ext: '', libc: 'glibc' },
  { id: 'win32-x64-msvc',  os: 'win32',  cpu: 'x64',   ext: '.exe' },
];

const { values } = parseArgs({
  options: {
    binaries: { type: 'string', default: 'artifacts' },
    out:      { type: 'string', default: 'dist/cli-npm' },
    version:  { type: 'string' },
  },
});

const wrapperPkgPath = join(REPO_ROOT, 'packages', 'elsa-to-mermaid-cli', 'package.json');
const wrapperPkg = JSON.parse(readFileSync(wrapperPkgPath, 'utf8'));
const version = values.version ?? wrapperPkg.version;
const licensePath = join(REPO_ROOT, 'LICENSE.md');

const binariesDir = resolve(REPO_ROOT, values.binaries);
const outDir = resolve(REPO_ROOT, values.out);

let built = 0;
const missing = [];

for (const p of PLATFORMS) {
  const binaryName = `elsa-to-mermaid${p.ext}`;
  const srcBinary = join(binariesDir, `cli-${p.id}`, binaryName);

  if (!existsSync(srcBinary)) {
    missing.push(`  - cli-${p.id}: ${srcBinary}`);
    continue;
  }

  const pkgName = `elsa-to-mermaid-cli-${p.id}`;
  const pkgDir = join(outDir, pkgName);
  const pkgBinDir = join(pkgDir, 'bin');
  mkdirSync(pkgBinDir, { recursive: true });

  const destBinary = join(pkgBinDir, binaryName);
  copyFileSync(srcBinary, destBinary);
  if (p.ext === '') chmodSync(destBinary, 0o755);

  copyFileSync(licensePath, join(pkgDir, 'LICENSE.md'));

  const pkgJson = {
    name: pkgName,
    version,
    description: `${p.os}/${p.cpu} native binary for elsa-to-mermaid-cli.`,
    license: wrapperPkg.license,
    author: wrapperPkg.author,
    homepage: wrapperPkg.homepage,
    repository: wrapperPkg.repository,
    bugs: wrapperPkg.bugs,
    os: [p.os],
    cpu: [p.cpu],
    ...(p.libc ? { libc: [p.libc] } : {}),
    files: ['bin', 'LICENSE.md'],
  };
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n');

  console.log(`✓ ${pkgName}@${version}`);
  built += 1;
}

if (missing.length > 0) {
  console.error('\nMissing binaries — these platforms were skipped:');
  console.error(missing.join('\n'));
  if (built === 0) {
    console.error('\nNo platforms built. Did the CLI build matrix run?');
    process.exit(1);
  }
  process.exit(2);
}

console.log(`\nBuilt ${built}/${PLATFORMS.length} platform packages → ${outDir}`);
