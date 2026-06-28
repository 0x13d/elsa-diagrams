# elsa-to-mermaid

Convert [Elsa Workflow](https://elsa-workflows.github.io/elsa-core/) JSON definitions
(v2.x and v3+) into [Mermaid](https://mermaid.js.org/) flowchart diagrams.

Ships as a Rust library, a WASM module, a CLI binary, a TypeScript npm package, and a
small web demo.

## Quick demo

```bash
# Install wasm-bindgen-cli once (we drive wasm-pack manually — see Build notes below)
cargo install wasm-bindgen-cli --version 0.2.121

# Run the full workspace
make test          # cargo workspace tests (24)
make cli           # release CLI at target/release/elsa-to-mermaid
make wasm wasm-node  # both wasm-bindgen output targets

# Try the CLI
./target/release/elsa-to-mermaid tests/fixtures/v3_composite.json
```

For the web app:

```bash
cd apps/web
npm install
npm run dev
```

For the VS Code extension:

```bash
cd apps/vscode-extension
npm install
npm run package          # produces elsa-to-mermaid-X.Y.Z.vsix
# Sideload it: VS Code → Extensions panel → "..." menu → Install from VSIX…
```

## Components

```text
crates/elsa_mermaid/      Rust core: detect → normalize → render
crates/elsa_mermaid_cli/  Thin binary wrapping the core
packages/elsa-to-mermaid/ npm package: WASM + LabelResolver
apps/web/                 Web demo (Vite + React)
apps/vscode-extension/    VS Code extension (Mermaid preview to the side)
tests/fixtures/           Canonical Elsa 2 and 3 inputs
```

## CLI

```text
elsa-to-mermaid [INPUT] [-o OUTPUT] [-d TD|LR|BT|RL] [--fenced]
```

- `INPUT` — workflow JSON file (omit to read stdin)
- `-o`, `--output` — write to file (omit for stdout)
- `-d`, `--direction` — flowchart layout direction (default `TD`)
- `--fenced` — wrap output in a ```` ```mermaid ```` block, ready to drop into Markdown

```bash
cat workflow.json | elsa-to-mermaid -d LR --fenced > workflow.md
```

## npm package

```ts
import { elsaToMermaid } from 'elsa-to-mermaid';

const diagram = await elsaToMermaid(workflowJson, {
  direction: 'LR',
  labelResolver: (type, id) => (id === 'If1' ? 'Approved?' : undefined),
});
```

`labelResolver` runs client-side as a post-processing pass and overrides individual
node labels by activity id and type. Returning `undefined` falls through to the
default sanitized label.

## How rendering decisions are made

- **Version detection** (`detect.rs`)
  - V3 if the root JSON has a `root` object.
  - V2 if the root JSON has an `activities` array whose first element has `activityId`.
- **Shape classification** (`label.rs`) maps the last segment of `activity_type`:
  - `If` / `Switch` / `Fork` → decision diamond
  - `Endpoint` / `Trigger` / `Start` / `Timer` / `Cron` / `Webhook` / `Finish` /
    `Fault` / `Terminate` → terminal pill
  - `Signal` / `Receive` / `Wait` / `Blocking` / `Approve` / `Suspend` → blocking lane
  - everything else → default box
- **Edge labels** — outcome `"Done"` is omitted on the arrow; any other outcome
  renders as `-->|Outcome|`.
- **Composites** — V3 activities with nested `activities` render as a Mermaid
  `subgraph`. `*.Sequence` composites with no explicit inner connections get
  implicit `Done` edges chained between their children.

## Build notes

- `wasm-pack 0.14.0` shells out to Cargo's `--out-dir` flag, which was renamed to
  `--artifact-dir` (and made nightly-only) in current Cargo. We sidestep wasm-pack
  and drive `cargo build --target wasm32-unknown-unknown` + `wasm-bindgen-cli`
  directly via the Makefile. Outputs are byte-identical to wasm-pack's.
- The Rust crate is `crate-type = ["cdylib", "rlib"]` and gates WASM bindings
  behind `--features wasm`.
- The npm package ships **two** WASM builds — `wasm/` (bundler target) and
  `wasm-node/` (CommonJS for Node). Conditional `exports` route consumers
  automatically; the bundler build is the production path.

## Project layout & contributing

- [SPEC.md](./SPEC.md) — authoritative conversion behavior (schemas, IR, rendering rules)
- [CLAUDE.md](./CLAUDE.md) — operational notes: how to build, where to make a
  given change, semantic versioning rules, and known gotchas
- [CHANGELOG.md](./CHANGELOG.md) — release history

## License

TBD.

## Release steps
Secrets:
NPM_TOKEN,
CARGO_REGISTRY_TOKEN
VSCE_PAT
OVSX_PAT