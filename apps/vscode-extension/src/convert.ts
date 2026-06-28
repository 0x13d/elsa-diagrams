import { createRequire } from 'node:module';
import * as path from 'node:path';

export type Direction = 'TD' | 'LR' | 'BT' | 'RL';

interface WasmModule {
  convert_to_mermaid(workflowJson: string, optionsJson: string): string;
  convert_to_spec(workflowJson: string): string;
  convert_to_combined(workflowJson: string, optionsJson: string): string;
}

let cached: WasmModule | null = null;

function loadWasm(): WasmModule {
  if (cached) return cached;
  // `__dirname` in the bundled extension points at dist/. The wasm-node files
  // ship in dist/wasm/ alongside the bundled extension entry.
  const wasmPath = path.join(__dirname, 'wasm', 'elsa_mermaid.js');
  const req = createRequire(__filename);
  cached = req(wasmPath) as WasmModule;
  return cached;
}

export function convert(workflowJson: string, direction: Direction = 'TD'): string {
  const wasm = loadWasm();
  return wasm.convert_to_mermaid(workflowJson, JSON.stringify({ direction }));
}

export function convertSpec(workflowJson: string): string {
  const wasm = loadWasm();
  return wasm.convert_to_spec(workflowJson);
}

export function convertCombined(
  workflowJson: string,
  direction: Direction = 'TD'
): string {
  const wasm = loadWasm();
  return wasm.convert_to_combined(workflowJson, JSON.stringify({ direction }));
}
