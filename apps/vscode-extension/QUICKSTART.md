# Quick Start
## Develop

```bash
npm install
npm run build        # full build (wasm copy + esbuild for both targets)
npm run watch        # esbuild watch mode
npm run package      # produce .vsix for marketplace upload / sideload
```

The Rust core + `wasm-node/` output must exist first. From the elsa-to-mermaid
repo root: `make wasm-node` (requires `wasm-bindgen-cli`).
