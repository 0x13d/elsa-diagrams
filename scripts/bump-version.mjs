#!/usr/bin/env node
// Bumps the lockstep version across every publishable surface and prepares the
// CHANGELOG for release.
//
//   node scripts/bump-version.mjs 0.3.0
//
// Updates:
//   - Cargo.toml                                      (workspace.package.version)
//   - crates/elsa_mermaid_cli/Cargo.toml              (elsa_mermaid path-dep version)
//   - packages/elsa-to-mermaid/package.json           (version)
//   - packages/elsa-to-mermaid-cli/package.json       (version + optionalDependencies versions)
//   - apps/vscode-extension/package.json              (version)
//
// And in CHANGELOG.md: moves the [Unreleased] block under a new dated section
// and starts a fresh empty [Unreleased]. Today's date is taken from the host.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(version)) {
  console.error('Usage: node scripts/bump-version.mjs <MAJOR.MINOR.PATCH[-pre]>');
  process.exit(1);
}

function readText(rel) {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}
function writeText(rel, content) {
  writeFileSync(join(REPO_ROOT, rel), content);
  console.log(`✓ ${rel}`);
}
function bumpJsonField(rel, mutate) {
  const json = JSON.parse(readText(rel));
  mutate(json);
  writeText(rel, JSON.stringify(json, null, 2) + '\n');
}

function replaceOrThrow(rel, pattern, replacement, label) {
  const text = readText(rel);
  if (!pattern.test(text)) throw new Error(`Did not find ${label} in ${rel}`);
  writeText(rel, text.replace(pattern, replacement));
}

// 1. Root Cargo.toml — workspace.package.version
replaceOrThrow(
  'Cargo.toml',
  /(\[workspace\.package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/,
  `$1${version}$2`,
  'workspace.package.version',
);

// 2. CLI crate path-dep version (the elsa_mermaid line)
replaceOrThrow(
  'crates/elsa_mermaid_cli/Cargo.toml',
  /(elsa_mermaid\s*=\s*\{\s*version\s*=\s*")[^"]+(")/,
  `$1${version}$2`,
  'elsa_mermaid path-dep version',
);

// 3. npm package
bumpJsonField('packages/elsa-to-mermaid/package.json', (j) => {
  j.version = version;
});

// 4. CLI wrapper + its optionalDependencies map
bumpJsonField('packages/elsa-to-mermaid-cli/package.json', (j) => {
  j.version = version;
  if (j.optionalDependencies) {
    for (const k of Object.keys(j.optionalDependencies)) {
      j.optionalDependencies[k] = version;
    }
  }
});

// 5. VS Code extension
bumpJsonField('apps/vscode-extension/package.json', (j) => {
  j.version = version;
});

// 6. CHANGELOG — promote [Unreleased] to a dated section.
{
  const rel = 'CHANGELOG.md';
  const text = readText(rel);
  const today = new Date().toISOString().slice(0, 10);
  const marker = '## [Unreleased]';
  if (!text.includes(marker)) throw new Error(`No "${marker}" section in ${rel}`);

  const freshUnreleased = [
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '### Changed',
    '',
    '### Fixed',
    '',
    `## [${version}] — ${today}`,
  ].join('\n');

  const updated = text.replace(marker, freshUnreleased);
  writeText(rel, updated);
}

console.log(`\nBumped to ${version}. Next steps:`);
console.log('  1. Review the diff: git diff');
console.log('  2. Edit CHANGELOG.md if needed.');
console.log(`  3. Commit: git commit -am "release: v${version}"`);
console.log(`  4. Tag:    git tag v${version} && git push --tags`);
