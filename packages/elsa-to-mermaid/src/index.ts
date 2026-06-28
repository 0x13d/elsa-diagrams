import {
  convert_to_combined,
  convert_to_mermaid,
  convert_to_spec,
} from '../wasm/elsa_mermaid.js';
import { makeElsaToCombined, makeElsaToMermaid, makeElsaToSpec } from './core.js';

export type { LabelResolver } from './resolver.js';
export type { ConvertOptions } from './core.js';

export const elsaToMermaid = makeElsaToMermaid(convert_to_mermaid);
export const elsaToSpec = makeElsaToSpec(convert_to_spec);
export const elsaToCombined = makeElsaToCombined(convert_to_combined);
