#!/usr/bin/env node
// Tiny launcher: resolves the platform-specific binary subpackage and execs it.
// The subpackages are declared as optionalDependencies in package.json; npm
// installs only the one whose os/cpu fields match the host, so require.resolve
// will succeed for exactly one of them on a supported platform.

const { execFileSync } = require('node:child_process');

const PLATFORMS = {
  'darwin-x64': 'elsa-to-mermaid-cli-darwin-x64',
  'darwin-arm64': 'elsa-to-mermaid-cli-darwin-arm64',
  'linux-x64': 'elsa-to-mermaid-cli-linux-x64-gnu',
  'linux-arm64': 'elsa-to-mermaid-cli-linux-arm64-gnu',
  'win32-x64': 'elsa-to-mermaid-cli-win32-x64-msvc',
};

const key = `${process.platform}-${process.arch}`;
const pkg = PLATFORMS[key];

if (!pkg) {
  console.error(
    `elsa-to-mermaid: unsupported platform ${key}.\n` +
      `Supported: ${Object.keys(PLATFORMS).join(', ')}.\n` +
      `Build from source: https://github.com/ariugwu/elsa-to-mermaid`,
  );
  process.exit(1);
}

const ext = process.platform === 'win32' ? '.exe' : '';
let binary;
try {
  binary = require.resolve(`${pkg}/bin/elsa-to-mermaid${ext}`);
} catch (err) {
  console.error(
    `elsa-to-mermaid: failed to locate native binary in ${pkg}.\n` +
      `This usually means the optional dependency wasn't installed.\n` +
      `Try: npm install --include=optional elsa-to-mermaid-cli\n\n` +
      String(err),
  );
  process.exit(1);
}

try {
  execFileSync(binary, process.argv.slice(2), { stdio: 'inherit' });
} catch (err) {
  const code = typeof err.status === 'number' ? err.status : 1;
  process.exit(code);
}
