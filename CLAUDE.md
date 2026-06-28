# CLAUDE.md

Operational notes for future Claude sessions on `elsa-to-mermaid`. This is the
**meta** doc — how to work in this repo. For the **conversion contract**, see
[SPEC.md](./SPEC.md); for **release history**, see [CHANGELOG.md](./CHANGELOG.md);
for **user docs**, see [README.md](./README.md).

## Read order on a cold start

1. This file (CLAUDE.md) — operational orientation
2. [SPEC.md](./SPEC.md) — what the code actually has to do
3. [CHANGELOG.md](./CHANGELOG.md) — recent direction-of-travel
4. The file(s) the user is asking about — only after the above

If the user mentions a specific bug or feature, jump to the relevant module
(see the layout below), but skim SPEC.md first if the change touches behavior.

## What this project is

A Rust core (compiled to native + WASM) that converts Elsa Workflow JSON (v2.x and v3+)
into Mermaid flowchart strings. The core is wrapped by a CLI binary, an npm package,
a web demo, and a VS Code extension. [SPEC.md](./SPEC.md) is authoritative for the
conversion contract; this file covers everything else.

## Repository layout

```text
crates/elsa_mermaid/        # Rust core lib (cdylib + rlib)
  src/ir.rs                 # Pure data: WorkflowIR, ActivityNode, NodeShape, EdgeIR
  src/detect.rs             # V2 vs V3 detection
  src/normalize.rs          # JSON → WorkflowIR for both versions
  src/label.rs              # Type → label sanitization + shape classification
  src/render.rs             # WorkflowIR → Mermaid string
  src/wasm.rs               # #[cfg(feature = "wasm")] surface
  src/lib.rs                # Public API: convert(), ConvertOptions, DirectionOpt
  tests/                    # Integration + snapshot tests
crates/elsa_mermaid_cli/    # CLI binary, clap-based
packages/elsa-to-mermaid/   # npm package (WASM-backed JS API)
  src/core.ts               # Shared TS logic + LabelResolver post-processor
  src/index.ts              # Bundler entry (imports from ../wasm)
  src/index.node.ts         # Node entry (imports from ../wasm-node)
  scripts/smoke.mjs         # Node smoke test runner
packages/elsa-to-mermaid-cli/  # npm wrapper for the native CLI binary
  bin/elsa-to-mermaid.js    # Launcher: resolves the platform-specific binary
  package.json              # optionalDependencies → per-platform subpackages
apps/web/                   # Vite + React + Tailwind demo app
apps/vscode-extension/      # VS Code extension (preview-to-the-side for *.json)
scripts/                    # Release & build tooling
  build-cli-npm-packages.mjs  # Materialize per-platform CLI subpackages from CI artifacts
  bump-version.mjs            # Lockstep version bump across all surfaces + CHANGELOG promote
.github/workflows/
  ci.yml                    # PR + main: cargo test, wasm smoke, vscode + web build
  release.yml               # Tag-triggered: matrix build CLI, publish to npm/crates.io/Marketplace/Open VSX
tests/fixtures/             # Canonical Elsa workflow JSON fixtures
```

## Build commands

```bash
make test            # cargo test --workspace (24 tests)
make cli             # cargo build --release -p elsa-mermaid-cli
make wasm            # WASM build for bundlers     → packages/elsa-to-mermaid/wasm/
make wasm-node       # WASM build for Node         → packages/elsa-to-mermaid/wasm-node/
make all             # wasm + wasm-node + cli

# npm package
cd packages/elsa-to-mermaid && npx tsc           # compile TS
cd packages/elsa-to-mermaid && node scripts/smoke.mjs  # Node smoke (10 checks)

# Web app
cd apps/web && npm install && npm run dev

# VS Code extension (requires `make wasm-node` first so dist/wasm/ can be populated)
cd apps/vscode-extension && npm install && npm run build      # produces dist/extension.js + dist/webview.js
cd apps/vscode-extension && npm run package                   # → elsa-to-mermaid-X.Y.Z.vsix
```

`wasm-pack` is **not** in the build path. wasm-pack 0.14.0 calls Cargo with `--out-dir`,
which was renamed to `--artifact-dir` (nightly-only) in Cargo 1.94+. We use
`cargo build --target wasm32-unknown-unknown` + `wasm-bindgen-cli` directly. Same
output. Install once with `cargo install wasm-bindgen-cli --version 0.2.121`.

## Pre-flight before any non-trivial change

Run these before changing rendering, normalization, or detection logic — they're
fast and catch most regressions:

```bash
make test                                                 # 24 cargo tests
node packages/elsa-to-mermaid/scripts/smoke.mjs           # 10 Node smoke checks
```

If you touch the web app or extension, also:

```bash
(cd apps/web && npm run build)
(cd apps/vscode-extension && npm run build)
```

The snapshot tests in `crates/elsa_mermaid/tests/render_snapshots.rs` are the
*output contract* — if a change breaks one, that's a conversation with the user
(maybe MAJOR), not a free update.

## Where to make a change

Decision list for "I need to change X":

- **Add a new activity type → shape mapping** —
  [`label.rs::classify_shape`](crates/elsa_mermaid/src/label.rs) + add a unit test
- **Change PascalCase splitting / truncation** —
  [`label.rs::sanitize_type`](crates/elsa_mermaid/src/label.rs)
- **Add a new Elsa schema version** — new branch in `detect.rs` + a new `normalize_vN`
  in `normalize.rs` (MAJOR bump candidate)
- **Add a flowchart direction or layout option** — `render.rs::Direction` +
  `lib.rs::DirectionOpt` + CLI flag + TS type (touches every surface; MINOR bump)
- **Tweak Mermaid output for one shape** —
  [`render.rs::emit_node`](crates/elsa_mermaid/src/render.rs) + update snapshot tests
- **Change how the npm `labelResolver` rewrites labels** —
  [`packages/elsa-to-mermaid/src/core.ts::applyLabelResolver`](packages/elsa-to-mermaid/src/core.ts)
- **Change CLI argument shape** —
  [`crates/elsa_mermaid_cli/src/main.rs`](crates/elsa_mermaid_cli/src/main.rs)
- **Change web app aesthetic / interaction** — `apps/web/src/components/`
  (Hero, Convert, HowItWorks, Header, Footer, Logo)
- **Change VS Code extension preview UI** —
  `apps/vscode-extension/src/webview/app.ts` + `src/preview.ts::renderHtml`

Adding a new public surface (e.g. a Python binding) means a new `crates/` or
`packages/` directory plus an entry here.

## Pipeline summary

```text
JSON string → detect (V2|V3) → normalize → WorkflowIR → render → Mermaid string
```

All four stages are pure, independently testable, and depend only on `serde_json`.
Full details (types, rules, edge cases) live in [SPEC.md](./SPEC.md).

## Versioning rules

Semantic versioning per [semver.org](https://semver.org/spec/v2.0.0.html). The Rust
core crate, CLI crate, `elsa-to-mermaid` npm package, `elsa-to-mermaid-cli` npm
wrapper (plus its five platform subpackages), **and the VS Code extension** version
in **lockstep** — one number covers them all. Bump together, release together. The
web app at `apps/web` rolls separately and is not versioned.

### When to bump what

- **MAJOR** (`0.x.0 → 1.0.0`, `1.x.y → 2.0.0`): break the public API of any surface.
  - Renamed or removed `pub` item in the Rust crate.
  - Changed CLI flag semantics or removed a flag.
  - Changed `elsaToMermaid` signature, removed an exported type, or shifted the
    conditional `exports` map in a way consumers can observe.
  - Changed Mermaid output for an unchanged input (consumers diff our output).
- **MINOR** (`0.1.0 → 0.2.0`, `1.0.0 → 1.1.0`): backwards-compatible additions.
  - New `pub` function, new CLI flag, new optional `ConvertOptions` field.
  - New activity-type shape mapping in `label.rs::classify_shape` (renders existing
    workflows the same, just classifies new ones).
  - New supported Elsa schema variant.
- **PATCH** (`0.1.0 → 0.1.1`): bug fixes only, no API surface change.
  - Fix incorrect Mermaid output for a documented schema.
  - Fix panic / error message in the parser.
  - Build-system fixes that don't affect consumers.

### Pre-1.0 caveat

We are at `0.1.0`. Under semver §4, anything goes pre-1.0 — but we still follow the
intent: bumps should be **MINOR for new features** and **PATCH for fixes**, even though
breaking changes are technically allowed at MINOR. When we hit `1.0.0`, the contract
hardens.

### Release checklist

When the user asks for a release:

1. Decide the bump (MAJOR / MINOR / PATCH) using the rules above.
2. Run `node scripts/bump-version.mjs X.Y.Z`. This updates the workspace
   `Cargo.toml`, the CLI's path-dep `version`, both npm `package.json`s
   (`elsa-to-mermaid` and `elsa-to-mermaid-cli` — the latter's
   `optionalDependencies` map is also bumped in lockstep), and the VS Code
   extension's `package.json`. It also promotes the `[Unreleased]` CHANGELOG
   block to a new dated section.
3. Edit the CHANGELOG if the auto-promotion needs cleanup. The script can't
   move existing bullet points around — it only adds the dated header.
4. Re-run `make test` and the Node smoke (`packages/elsa-to-mermaid/scripts/smoke.mjs`).
5. Commit `release: vX.Y.Z`, tag `vX.Y.Z`, push tag.
6. The `release.yml` workflow does the rest: matrix-builds the CLI for five
   platforms, then publishes to crates.io, npm (wasm pkg + cli wrapper + five
   platform subpackages), the VS Code Marketplace, Open VSX, and creates a
   GitHub Release with the binaries attached. Run `workflow_dispatch` with
   `dry_run: true` first if you want to verify the build without publishing.

### Required secrets

The release workflow needs these repository secrets configured:

- `NPM_TOKEN` — npm access token with publish permission for the
  `elsa-to-mermaid*` namespace.
- `CARGO_REGISTRY_TOKEN` — crates.io API token.
- `VSCE_PAT` — Azure DevOps PAT for the VS Code Marketplace publisher.
- `OVSX_PAT` — Open VSX access token.

GitHub Releases publishing uses the workflow's built-in `GITHUB_TOKEN`.

### CHANGELOG hygiene

Every PR that touches a versioned surface adds an entry under `[Unreleased]` with the
correct section: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. The
web app is **not** versioned — it gets a rolling deploy — but notable changes there
can be noted under `Changed` for visibility.

## Things to be careful about

- The Rust core has no dependencies beyond `serde` and `serde_json`. Adding more
  needs a real reason — keep the WASM footprint small.
- `mermaid_id` in `render.rs` replaces any non-`[a-zA-Z0-9_]` character with `_`.
  Mermaid IDs are also used as edge endpoints, so the same sanitization is applied
  on both ends.
- Label content is double-quoted in Mermaid and `"` characters are escaped to
  `#quot;`. Don't switch to single quotes; Mermaid treats them differently.
- The npm package's TS `LabelResolver` runs **after** the WASM call, by string
  replacement. It cannot cross the WASM boundary (functions don't serialize).
- `wasm-node/` ships a sibling `package.json` with `"type": "commonjs"` so Node ESM
  doesn't try to load wasm-bindgen's CJS output as ESM. Don't delete it.
- **Web app uses `build.target: 'esnext'` deliberately.** `vite-plugin-wasm` injects
  a top-level `await WebAssembly.instantiate(...)` into the bundle. If the build
  target is older than ES2022, Vite needs `vite-plugin-top-level-await` to shim it
  — and that plugin AST-rewrites `function` declarations into `var` assignments,
  which breaks d3-color's hoisting (mermaid's transitive dep) and throws
  *"Cannot set properties of undefined (setting 'prototype')"* at module init in
  production. Emit native TLA and keep the plugin uninstalled.
- **VS Code extension wasm path is `__dirname/wasm/`** — `convert.ts` does
  `path.join(__dirname, 'wasm', 'elsa_mermaid.js')` and `require()`s it via
  `createRequire(__filename)`. esbuild bundles the extension entry but treats
  `./wasm/*` as external (`apps/vscode-extension/esbuild.config.mjs`), so the
  wasm-node folder must be copied into `dist/wasm/` before packaging. That's what
  `scripts/copy-wasm.mjs` does, and `npm run build` invokes it first.

## Working in this repo — gotchas

These are things I've already burned time on. Read this once before doing the
equivalent work.

- **Background processes inherit cwd, foreground commands don't.** When running
  `npm install` and similar inside `apps/web` or `apps/vscode-extension`, use an
  absolute path or `cd` only inside the same command. A `cd` in one Bash call does
  not carry to the next call.
- **Don't `Read` a file you just edited to confirm.** The harness errors loudly if
  Write/Edit silently dropped a change; re-reading is wasted tokens.
- **Hooks may block writes** — the security hook flags `innerHTML` even when the
  content is sanitized upstream (e.g. mermaid `securityLevel: 'strict'`). Use
  `DOMParser` + `replaceChildren` instead. See `apps/web/src/components/Convert.tsx`
  and `apps/vscode-extension/src/webview/app.ts` for the pattern.
- **Markdown lint warnings are advisory but visible to the user.** Common ones we
  silence via `.markdownlint.json`:
  - `MD024 siblings_only: true` — Keep a Changelog wants duplicate `### Added` etc.
  - `MD013: false` — we wrap by sentence, not column count.
  Fenced code blocks always get a language hint (`text`, `bash`, `json`, etc.).
- **The Playwright MCP tool saves screenshots to the *parent* directory** of the
  current working dir, not the cwd itself. If you ask for `./hero.png`, it lands at
  `../hero.png`. Use `find /Users/ariugwu -name <file> -newer <ref>` to locate it.
- **VS Code can't be launched from this harness.** Verifying the extension means
  type-checking, building, packaging with `vsce`, and asking the user to sideload.
  Don't claim runtime correctness for the extension without that loop closing.

## Common workflows

### Adding a new activity-type shape

1. Touch `crates/elsa_mermaid/src/label.rs::classify_shape` — add the pattern.
2. Add a unit test in the `label::tests` module covering the new pattern.
3. Run `make test`.
4. CHANGELOG entry under `[Unreleased] · Added` — MINOR bump.

### Adding a CLI flag

1. Add the field to `crates/elsa_mermaid_cli/src/main.rs::Args`.
2. Thread it into `ConvertOptions` if it's a conversion concern, or handle it
   locally if it's CLI-only (e.g. `--fenced`).
3. Update the README CLI section.
4. CHANGELOG entry — MINOR bump.

### Reproducing a production-only bug

```bash
# Web app
cd apps/web && npx vite build --base=./ && \
  cp -r dist /tmp/elsa-prod && \
  cd /tmp && python3 -m http.server 8765 &
# Then navigate to http://localhost:8765/elsa-prod/

# VS Code extension
(cd apps/vscode-extension && npm run package)
# Sideload the .vsix and ask the user to try.
```

The Vite TLA / d3-color bug only surfaced in production builds — dev mode masked it.

### Releasing

Process is in **Versioning rules → Release checklist** above. The short version:
bump the four version fields, move `[Unreleased]` into a dated section, re-run
`make test` and the Node smoke, commit `release: vX.Y.Z`.
