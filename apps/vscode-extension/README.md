# Elsa to Mermaid — VS Code Extension

Live Mermaid preview for [Elsa Workflow](https://elsa-workflows.github.io/elsa-core/)
JSON definitions, side by side with the editor. Supports Elsa v2.x and v3+.

## Features

- **Open Mermaid Preview to the Side** — `cmd/ctrl+shift+P` → *Elsa to Mermaid: Open
  Mermaid Preview to the Side*. The preview updates as you edit the JSON.
- **Direction toggle** — TD / LR / BT / RL inside the preview toolbar.
- **Export to Markdown** — produces a `<workflow>.md` with the diagram inside a
  ```` ```mermaid ```` fenced block, ready to drop into a README.
- **Theme-aware** — the diagram follows your VS Code light/dark theme.

## How it knows it's an Elsa workflow

Same detection the CLI/library uses: V3 if the JSON has a `root.activities` array,
V2 if it has an `activities` array whose first element has `activityId`. Anything else
shows an empty state.

## Settings

| Setting                              | Default | Description                                              |
|--------------------------------------|---------|----------------------------------------------------------|
| `elsaToMermaid.defaultDirection`     | `TD`    | Flowchart direction the preview opens with.              |
| `elsaToMermaid.previewDebounceMs`    | `200`   | Debounce window for live preview updates while editing.  |

## Architecture

Conversion runs in-process via the same Rust → WASM core that powers the
`elsa-to-mermaid` npm package and CLI. The `wasm-node/` build is shipped inside the
extension — **no network, no sandboxed shell-out, fully offline**. Mermaid rendering
happens inside the webview using the bundled Mermaid 11 runtime.
