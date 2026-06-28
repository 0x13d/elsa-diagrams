export interface SpecMeta {
  title: string;
  chips: string[];
}

export interface SpecBlock {
  /** Block heading without the leading `**...**` markers, e.g. "Endpoint", "Flow". */
  heading: string;
  /** Markdown lines below the heading until the next blank line / heading / activity marker. */
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
const STRONG_HEADING = /^\*\*(.+)\*\*\s*$/;

export function parseSpec(markdown: string): ParsedSpec {
  const lines = markdown.split('\n');
  const meta: SpecMeta = { title: '', chips: [] };
  const sections: SpecSection[] = [];

  let cursor = 0;

  // Title (first H1)
  while (cursor < lines.length) {
    const m = lines[cursor].match(HEADING);
    if (m && m[1].length === 1) {
      meta.title = m[2].trim();
      cursor++;
      break;
    }
    cursor++;
  }

  // Workflow meta chips: first non-empty line that starts with **
  while (cursor < lines.length) {
    const l = lines[cursor].trim();
    cursor++;
    if (!l) continue;
    if (l.startsWith('**')) {
      meta.chips = splitChips(l);
      break;
    }
    if (l.startsWith('<!--')) {
      // No meta chips — back up and let activity loop handle it
      cursor--;
      break;
    }
    if (l.startsWith('## Diagram') || l.startsWith('## Activities')) {
      // Combined-mode preamble done
      cursor--;
      break;
    }
  }

  // Activity sections
  while (cursor < lines.length) {
    const m = lines[cursor].match(ACTIVITY_MARKER);
    if (!m) {
      cursor++;
      continue;
    }
    const id = m[1];
    cursor++;

    // Next line is the heading
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

    // Skip blank lines
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;

    // Chips line — distinguishable from a strong heading (`**Word**`) by either
    // containing the &middot; separator or by content following the bold span.
    let chips: string[] = [];
    if (cursor < lines.length) {
      const t = lines[cursor].trim();
      const isStrongHeadingOnly = /^\*\*[^*]+\*\*\s*$/.test(t);
      if (t.startsWith('**') && !isStrongHeadingOnly) {
        chips = splitChips(t);
        cursor++;
      }
    }

    // Collect blocks until the next activity marker
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
        // collect body until blank-line + new strong-heading / next activity marker / EOF
        while (cursor < lines.length) {
          const next = lines[cursor];
          if (next.match(ACTIVITY_MARKER)) break;
          const nextTrimmed = next.trim();
          if (!nextTrimmed) {
            // Peek: blank followed by another **heading** ends this block.
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
      // Unclassified prose under the chips — treat as a Notes block
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
  // Each chip is a `**Key:** value` segment separated by ` &middot; `.
  return line
    .split(/\s*&middot;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
