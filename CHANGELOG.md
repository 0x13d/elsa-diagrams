# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The Rust crate, CLI, and npm package are versioned together — a single version
covers all three. The web app at `apps/web` is not versioned (rolling deploy).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.4.0] — 2026-05-17

### Added

- **Release pipeline** (`.github/workflows/release.yml`): tag-triggered
  (`vX.Y.Z`) workflow that builds the CLI for five targets
  (`darwin-x64`, `darwin-arm64`, `linux-x64-gnu`, `linux-arm64-gnu`,
  `win32-x64-msvc`), then publishes to npm, crates.io, the VS Code
  Marketplace, Open VSX, and GitHub Releases. Supports `workflow_dispatch`
  with a `dry_run` flag for end-to-end build verification without publishing.
- **`elsa-to-mermaid-cli` npm wrapper** (`packages/elsa-to-mermaid-cli/`):
  installs the native CLI via `npm i -g elsa-to-mermaid-cli`. Uses the
  esbuild-style optionalDependencies pattern — one platform-specific
  subpackage per supported target — and a tiny launcher
  (`bin/elsa-to-mermaid.js`) that resolves and execs the right binary.
- **CI workflow** (`.github/workflows/ci.yml`): cargo tests + WASM smoke +
  VS Code extension build + web build on every push to `main` and on PRs.
- **`scripts/build-cli-npm-packages.mjs`**: materializes per-platform npm
  subpackages from a directory of CI-uploaded binaries.
- **`scripts/bump-version.mjs`**: bumps the lockstep version across all five
  metadata locations (`Cargo.toml` workspace, CLI path-dep version, both
  `package.json`s for the npm packages, VS Code extension `package.json`)
  and promotes the CHANGELOG `[Unreleased]` block to a dated section.
- **Cargo workspace metadata**: shared `[workspace.package]` block with
  `license`, `repository`, `homepage`, `keywords`, `categories`, and authors;
  per-crate `description`. Required for crates.io publishing.
- **Web — Download modal**: header "Try it" button became "Download", which
  opens a themed modal with three install paths (npm, VS Code Marketplace,
  CLI binary from GitHub Releases).

### Changed

- **License**: project now ships under a custom proprietary "Elsa-to-Mermaid
  License" (`LICENSE.md` at the workspace root). Permits personal and
  commercial use of the unmodified binaries/packages; prohibits copying,
  modifying, or redistributing the source code. Replaces the earlier
  placeholder `MIT` entries in Cargo and the npm/VS Code packages. The Cargo
  workspace uses `license-file = "LICENSE.md"`; the npm packages and VS Code
  extension declare `"license": "SEE LICENSE IN LICENSE.md"` per SPDX. Use
  `node scripts/sync-license.mjs` to mirror the file into the npm and
  extension directories after edits.
- VS Code extension `package.json` `license` flipped from `"TBD"` to the
  project license; added `repository`, `homepage`, `bugs`, and `author`
  fields for Marketplace metadata.

- VS Code extension at `apps/vscode-extension` — opens a live Mermaid preview to
  the side of any Elsa workflow JSON. Reuses the existing `wasm-node` build for
  in-process conversion (offline, no network). Ships the Mermaid runtime bundled
  for the webview. Includes commands for *Open Preview*, *Open Preview to the
  Side*, and *Export to Markdown*, plus a direction setting.
- **Spec sheet generation**: a new pipeline stage emits a per-workflow Markdown
  document alongside the Mermaid diagram. Captures workflow metadata, per-activity
  properties (with curated pretty-printing for `HttpEndpoint`, `If`, `Switch`,
  `SendEmail`, `SignalReceived`, `SendSignal`, `WriteLine`, `Timer`, `Cron`,
  `Delay`, `SetVariable`, `HttpResponse`), inbound/outbound flow, and Elsa
  configuration flags (`persistWorkflow`, etc.). Each activity is anchored by an
  HTML comment marker (`<!-- elsa-activity: ID -->`) for downstream tooling.
  - Rust: `convert_spec()` and `convert_combined()` on the public crate.
  - WASM: `convert_to_spec()` and `convert_to_combined()` bindings.
  - npm: `elsaToSpec()` and `elsaToCombined()`; combined output preserves the
    existing `labelResolver` post-processing on the fenced Mermaid block.
  - CLI: `--format=mermaid|spec|combined` plus shortcut flags `--spec` and
    `--combined`.
- **Web app — Tufte-style "Paper" view**: the converter pane gains a three-way
  view toggle (Paper / Diagram / Spec). The Paper view renders the diagram as a
  full-width figure and lays out per-activity detail in the right margin as
  sidenotes (Tufte CSS pattern), with the orange accent stripe matching the rest
  of the design system. Adds a Downloads dropdown with four options: Mermaid
  diagram (.mmd), Spec sheet (.md), Combined paper (.md), and *Print paper…*
  (uses the browser print dialog and a dedicated print stylesheet so the Tufte
  layout exports to PDF cleanly).
- **VS Code extension — view modes**: the preview now offers Paper / Diagram /
  Spec tabs and an Export dropdown matching the three download formats. The
  Paper view uses the same Tufte two-column pattern, styled with VS Code theme
  tokens so it adapts to light and dark themes.
- IR extended on the Rust side: `WorkflowIR` carries `definition_id`,
  `is_published`, `is_latest`; `ActivityNode` carries `properties`
  (`Vec<PropertyIR>`) and `extras` (a `BTreeMap` of well-known config flags);
  `EdgeIR` carries an optional `target_port`.

### Fixed

- Web app: production build crashed at module init with
  `TypeError: Cannot set properties of undefined (setting 'prototype')`. Root cause:
  `vite-plugin-top-level-await` was rewriting d3-color's `function color()`
  declaration into a `var` assignment, breaking the hoisting that mermaid's call
  to `define(Color, color, …)` depends on. Removed the plugin and set
  `build.target: 'esnext'` so Vite emits native top-level await.

## [0.1.0] — 2026-05-13

### Added

- Rust core crate `elsa_mermaid` with version detection, normalization, and Mermaid rendering
  for Elsa 2.x and 3+ workflow JSON.
- IR types and per-shape rendering: `Default`, `Decision`, `Terminal`, `Blocking`.
- Composite (subgraph) rendering, including implicit `Done` chains for `*.Sequence` composites
  that ship without explicit inner connections.
- CLI `elsa-to-mermaid` with file/stdin input, file/stdout output, `--direction`, and `--fenced`.
- WASM build target (`make wasm` for bundlers, `make wasm-node` for Node) driven by
  `wasm-bindgen-cli` directly (wasm-pack 0.14.0 is broken against Cargo 1.94).
- npm package `elsa-to-mermaid` exposing `elsaToMermaid()` with optional `LabelResolver`
  post-processing. Conditional exports route Node consumers to the CJS-wasm build and
  bundler consumers to the ES-wasm build.
- Web demo app at `apps/web` for pasting workflow JSON and downloading the rendered
  Mermaid as a Markdown file.
- Test coverage: 24 cargo tests (unit + integration + render snapshots) plus a 10-check
  Node smoke for the npm package.
