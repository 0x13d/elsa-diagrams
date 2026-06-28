import workflowA from './workflow-a-filewatcher.json?raw';
import workflowB from './workflow-b-csv2json.json?raw';
import workflowC from './workflow-c-audit.json?raw';

export interface ExampleWorkflow {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  tags: string[];
  /** Raw Elsa JSON definition (string). */
  json: string;
  /** Filename used when downloading. */
  filename: string;
  /** Optional related ADR slugs (rendered as cross-links). */
  adrs?: string[];
}

export const EXAMPLES: ExampleWorkflow[] = [
  {
    slug: 'workflow-a-filewatcher',
    title: 'Workflow A — File Watcher (CSV)',
    tagline: 'Watch a drop folder, hand the CSV off, audit the result.',
    description:
      'A directory watcher fires on every *.csv arrival. The bytes are read, base64-encoded, and passed to Workflow B for parsing. Workflow C records the outcome.',
    tags: ['trigger', 'fan-out', 'subworkflow'],
    json: workflowA,
    filename: 'workflow-a-filewatcher.json',
    adrs: ['0001-audit-pattern'],
  },
  {
    slug: 'workflow-b-csv2json',
    title: 'Workflow B — CSV → JSON',
    tagline: 'A reusable subworkflow that decodes and parses base64 CSV.',
    description:
      'Accepts `csvBase64`, decodes it, parses with headers, and returns either a row array or a structured parse error. Designed to be called from anything.',
    tags: ['subworkflow', 'parser'],
    json: workflowB,
    filename: 'workflow-b-csv2json.json',
  },
  {
    slug: 'workflow-c-audit',
    title: 'Workflow C — Audit',
    tagline: 'The canonical audit pattern. Standard envelope in, JSON report out.',
    description:
      'Every workflow can call this with a small structured envelope (source, status, error?, count?, ref?). It emits a normalized Audit Report, pages on failure, and appends to the audit log.',
    tags: ['subworkflow', 'audit', 'best-practice'],
    json: workflowC,
    filename: 'workflow-c-audit.json',
    adrs: ['0001-audit-pattern'],
  },
];

export function getExample(slug: string): ExampleWorkflow | undefined {
  return EXAMPLES.find((e) => e.slug === slug);
}
