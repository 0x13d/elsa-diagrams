import type { LabelResolver } from './resolver.js';

export interface ConvertOptions {
  direction?: 'TD' | 'LR' | 'BT' | 'RL';
  labelResolver?: LabelResolver;
}

export type ConvertFn = (workflowJson: string, optionsJson: string) => string;
export type SpecFn = (workflowJson: string) => string;

export function makeElsaToMermaid(convertFn: ConvertFn) {
  return async function elsaToMermaid(
    workflowJson: string | object,
    options: ConvertOptions = {}
  ): Promise<string> {
    const json =
      typeof workflowJson === 'string' ? workflowJson : JSON.stringify(workflowJson);

    const { labelResolver, ...wasmOpts } = options;

    let result = convertFn(
      json,
      JSON.stringify({ direction: wasmOpts.direction ?? 'TD' })
    );

    if (labelResolver) {
      result = applyLabelResolver(result, json, labelResolver);
    }

    return result;
  };
}

export function makeElsaToSpec(specFn: SpecFn) {
  return async function elsaToSpec(workflowJson: string | object): Promise<string> {
    const json =
      typeof workflowJson === 'string' ? workflowJson : JSON.stringify(workflowJson);
    return specFn(json);
  };
}

export function makeElsaToCombined(combinedFn: ConvertFn) {
  return async function elsaToCombined(
    workflowJson: string | object,
    options: ConvertOptions = {}
  ): Promise<string> {
    const json =
      typeof workflowJson === 'string' ? workflowJson : JSON.stringify(workflowJson);

    const { labelResolver, ...wasmOpts } = options;

    let result = combinedFn(
      json,
      JSON.stringify({ direction: wasmOpts.direction ?? 'TD' })
    );

    if (labelResolver) {
      result = applyLabelResolverToFencedMermaid(result, json, labelResolver);
    }

    return result;
  };
}

interface WalkedActivity {
  id: string;
  type: string;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function collectActivities(workflow: unknown): WalkedActivity[] {
  const acc: WalkedActivity[] = [];
  if (!isObj(workflow)) return acc;

  const flatV2 =
    Array.isArray(workflow.activities) &&
    isObj(workflow.activities[0]) &&
    typeof (workflow.activities[0] as Record<string, unknown>).activityId === 'string';

  if (flatV2) {
    for (const a of workflow.activities as unknown[]) {
      if (isObj(a) && typeof a.activityId === 'string' && typeof a.type === 'string') {
        acc.push({ id: a.activityId, type: a.type });
      }
    }
    return acc;
  }

  if (isObj(workflow.root)) {
    walkV3(workflow.root, acc);
  }
  return acc;
}

function walkV3(container: Record<string, unknown>, acc: WalkedActivity[]): void {
  if (!Array.isArray(container.activities)) return;
  for (const a of container.activities) {
    if (!isObj(a)) continue;
    if (typeof a.id === 'string' && typeof a.type === 'string') {
      acc.push({ id: a.id, type: a.type });
    }
    if (Array.isArray(a.activities)) {
      walkV3(a, acc);
    }
  }
}

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '#quot;');
}

function applyLabelResolver(
  mermaid: string,
  workflowJson: string,
  resolver: LabelResolver
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(workflowJson);
  } catch {
    return mermaid;
  }

  const activities = collectActivities(parsed);
  const replacements = new Map<string, string>();

  for (const { id, type } of activities) {
    const resolved = resolver(type, id);
    if (resolved !== undefined) {
      replacements.set(sanitizeMermaidId(id), escapeLabel(resolved));
    }
  }

  if (replacements.size === 0) return mermaid;

  return mermaid
    .split('\n')
    .map((line) => rewriteLine(line, replacements))
    .join('\n');
}

function applyLabelResolverToFencedMermaid(
  combined: string,
  workflowJson: string,
  resolver: LabelResolver
): string {
  const start = combined.indexOf('```mermaid');
  if (start === -1) return combined;
  const after = combined.indexOf('\n', start);
  if (after === -1) return combined;
  const end = combined.indexOf('```', after + 1);
  if (end === -1) return combined;

  const mermaid = combined.slice(after + 1, end);
  const rewritten = applyLabelResolver(mermaid, workflowJson, resolver);
  return combined.slice(0, after + 1) + rewritten + combined.slice(end);
}

const NODE_HEAD = /^([a-zA-Z0-9_]+)[\[{(]/;

function rewriteLine(line: string, replacements: Map<string, string>): string {
  if (line.includes(' --> ')) return line;

  const stripped = line.trimStart();
  if (stripped.length === 0) return line;

  let id: string | undefined;
  if (stripped.startsWith('subgraph ')) {
    const rest = stripped.slice('subgraph '.length);
    const bracket = rest.indexOf('[');
    if (bracket > 0) id = rest.slice(0, bracket);
  } else {
    const m = stripped.match(NODE_HEAD);
    if (m) id = m[1];
  }

  if (!id) return line;
  const replacement = replacements.get(id);
  if (replacement === undefined) return line;

  return swapQuotedContent(line, replacement);
}

function swapQuotedContent(line: string, newLabel: string): string {
  const first = line.indexOf('"');
  const last = line.lastIndexOf('"');
  if (first === -1 || first === last) return line;
  return line.slice(0, first + 1) + newLabel + line.slice(last);
}
