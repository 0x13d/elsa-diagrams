import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [react(), wasm()],
  build: {
    // Native top-level await. vite-plugin-wasm injects `await WebAssembly.instantiate(...)`
    // at module scope; downcompiling that via vite-plugin-top-level-await rewrites
    // function declarations into `var` assignments, which breaks d3-color's hoisting
    // (mermaid then throws "Cannot set properties of undefined" at init). Emitting
    // native TLA preserves the declarations.
    target: 'esnext'
  },
  server: {
    fs: {
      allow: ['../..']
    }
  },
  optimizeDeps: {
    exclude: ['elsa-to-mermaid']
  }
});
