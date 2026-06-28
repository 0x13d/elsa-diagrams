import adr0001 from './0001-audit-pattern.md?raw';

export interface AdrMeta {
  slug: string;
  number: string;
  title: string;
  status: string;
  date: string;
  summary: string;
  markdown: string;
}

function extractField(md: string, key: string): string | null {
  const re = new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)$`, 'm');
  const m = md.match(re);
  return m ? m[1].trim() : null;
}

function makeAdr(slug: string, markdown: string, summary: string): AdrMeta {
  const titleMatch = markdown.match(/^#\s+ADR-(\d+)\s*[·.\-]?\s*(.*)$/m);
  const number = titleMatch ? titleMatch[1] : slug.split('-')[0];
  const title = titleMatch ? titleMatch[2].trim() : slug;
  return {
    slug,
    number,
    title,
    status: extractField(markdown, 'Status') ?? 'Unknown',
    date: extractField(markdown, 'Date') ?? '',
    summary,
    markdown,
  };
}

export const ADRS: AdrMeta[] = [
  makeAdr(
    '0001-audit-pattern',
    adr0001,
    'A small shared envelope and canonical report shape that any workflow can use to record outcomes through a central Audit subworkflow.',
  ),
];

export function getAdr(slug: string): AdrMeta | undefined {
  return ADRS.find((a) => a.slug === slug);
}
