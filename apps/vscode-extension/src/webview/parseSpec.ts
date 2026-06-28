export interface SpecMeta {
  title: string;
  chips: string[];
}

export interface SpecBlock {
  heading: string;
  body: string[];
}

export interface SpecSection {
  id: string;
  depth: number;
  title: string;
  chips: string[];
  blocks: SpecBlock[];
  isComposite: boolean;
}

export interface ParsedSpec {
  meta: SpecMeta;
  sections: SpecSection[];
}

const ACTIVITY_MARKER = /^<!--\s*elsa-activity:\s*(.+?)\s*-->\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const STRONG_HEADING = /^\*\*([^*]+)\*\*\s*$/;

export function parseSpec(markdown: string): ParsedSpec {
  const lines = markdown.split('\n');
  const meta: SpecMeta = { title: '', chips: [] };
  const sections: SpecSection[] = [];

  let cursor = 0;

  while (cursor < lines.length) {
    const m = lines[cursor].match(HEADING);
    if (m && m[1].length === 1) {
      meta.title = m[2].trim();
      cursor++;
      break;
    }
    cursor++;
  }

  while (cursor < lines.length) {
    const l = lines[cursor].trim();
    cursor++;
    if (!l) continue;
    if (l.startsWith('**')) {
      const isStrongHeadingOnly = STRONG_HEADING.test(l);
      if (!isStrongHeadingOnly) {
        meta.chips = splitChips(l);
      } else {
        cursor--;
      }
      break;
    }
    if (l.startsWith('<!--') || l.startsWith('## Diagram') || l.startsWith('## Activities')) {
      cursor--;
      break;
    }
  }

  while (cursor < lines.length) {
    const m = lines[cursor].match(ACTIVITY_MARKER);
    if (!m) {
      cursor++;
      continue;
    }
    const id = m[1];
    cursor++;

    let depth = 2;
    let title = id;
    if (cursor < lines.length) {
      const h = lines[cursor].match(HEADING);
      if (h) {
        depth = h[1].length;
        title = h[2].trim();
        cursor++;
      }
    }

    while (cursor < lines.length && !lines[cursor].trim()) cursor++;

    let chips: string[] = [];
    if (cursor < lines.length) {
      const t = lines[cursor].trim();
      const isStrongHeadingOnly = STRONG_HEADING.test(t);
      if (t.startsWith('**') && !isStrongHeadingOnly) {
        chips = splitChips(t);
        cursor++;
      }
    }

    const blocks: SpecBlock[] = [];
    let isComposite = false;
    while (cursor < lines.length) {
      const raw = lines[cursor];
      if (raw.match(ACTIVITY_MARKER)) break;
      const trimmed = raw.trim();
      if (!trimmed) {
        cursor++;
        continue;
      }
      if (trimmed.startsWith('_Composite activity')) {
        isComposite = true;
        cursor++;
        continue;
      }
      const sh = trimmed.match(STRONG_HEADING);
      if (sh) {
        const block: SpecBlock = { heading: sh[1].trim(), body: [] };
        cursor++;
        while (cursor < lines.length) {
          const next = lines[cursor];
          if (next.match(ACTIVITY_MARKER)) break;
          const nextTrimmed = next.trim();
          if (!nextTrimmed) {
            let look = cursor + 1;
            while (look < lines.length && !lines[look].trim()) look++;
            if (
              look < lines.length &&
              (lines[look].match(ACTIVITY_MARKER) ||
                lines[look].trim().match(STRONG_HEADING) ||
                lines[look].trim().startsWith('_Composite activity'))
            ) {
              cursor = look;
              break;
            }
            cursor++;
            continue;
          }
          block.body.push(next);
          cursor++;
        }
        blocks.push(block);
        continue;
      }
      const block: SpecBlock = { heading: 'Notes', body: [] };
      while (cursor < lines.length) {
        const next = lines[cursor];
        if (next.match(ACTIVITY_MARKER)) break;
        const t = next.trim();
        if (!t) {
          cursor++;
          break;
        }
        if (t.match(STRONG_HEADING) || t.startsWith('_Composite activity')) break;
        block.body.push(next);
        cursor++;
      }
      blocks.push(block);
    }

    sections.push({ id, depth, title, chips, blocks, isComposite });
  }

  return { meta, sections };
}

function splitChips(line: string): string[] {
  return line
    .split(/\s*&middot;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
