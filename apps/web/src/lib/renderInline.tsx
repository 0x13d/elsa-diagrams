import { Fragment, type ReactNode } from 'react';

/**
 * Render a focused subset of inline markdown that our spec emitter produces:
 *   **bold**     `code`     *italic*     _italic_     plain text
 * Anything else passes through verbatim.
 */
export function renderInline(text: string, keyBase = ''): ReactNode {
  const out: ReactNode[] = [];
  let i = 0;
  let buf = '';
  let n = 0;
  const flush = () => {
    if (buf) {
      out.push(<Fragment key={`${keyBase}t${n++}`}>{buf}</Fragment>);
      buf = '';
    }
  };

  while (i < text.length) {
    const ch = text[i];
    const two = text.slice(i, i + 2);
    if (two === '**') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        out.push(
          <strong key={`${keyBase}b${n++}`} className="font-semibold">
            {text.slice(i + 2, end)}
          </strong>
        );
        i = end + 2;
        continue;
      }
    }
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        out.push(
          <code
            key={`${keyBase}c${n++}`}
            className="font-mono text-[0.86em] bg-paperDim/70 px-1 py-px rounded text-ink"
          >
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && text[i + 1] !== ch) {
      const end = text.indexOf(ch, i + 1);
      if (end !== -1 && end !== i + 1) {
        flush();
        out.push(
          <em key={`${keyBase}i${n++}`} className="italic text-inkSoft">
            {text.slice(i + 1, end)}
          </em>
        );
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/**
 * Render a list of markdown body lines as a mix of bullet lists, plain paragraphs,
 * and indented sub-bullets. Returns one ReactNode (a fragment).
 */
export function renderBody(lines: string[], keyBase: string): ReactNode {
  const items: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // closing fence
      items.push(
        <pre
          key={`${keyBase}-pre-${i}`}
          className="my-3 rounded-lg bg-paperDim/60 border border-ink/10 p-3 font-mono text-[12.5px] leading-[1.55] text-ink overflow-x-auto"
          data-lang={lang || undefined}
        >
          {buf.join('\n')}
        </pre>
      );
      continue;
    }
    // Top-level bullet
    if (/^[-*]\s+/.test(line)) {
      const group: { text: string; sub: string[] }[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(/^([-*])\s+(.*)$/);
        if (m) {
          group.push({ text: m[2], sub: [] });
          i++;
          while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
            const sm = lines[i].match(/^\s+[-*]\s+(.*)$/);
            if (sm) group[group.length - 1].sub.push(sm[1]);
            i++;
          }
        } else {
          break;
        }
      }
      items.push(
        <ul
          key={`${keyBase}-ul-${i}`}
          className="my-2 space-y-1.5 list-none pl-0 text-[15px] leading-[1.55]"
        >
          {group.map((g, ix) => (
            <li key={`${keyBase}-li-${ix}`} className="text-ink">
              <span className="mr-2 text-ember">·</span>
              {renderInline(g.text, `${keyBase}-li-${ix}-`)}
              {g.sub.length > 0 && (
                <ul className="mt-1 space-y-0.5 pl-5 text-[14px] text-inkSoft">
                  {g.sub.map((s, sx) => (
                    <li key={`${keyBase}-sli-${ix}-${sx}`}>
                      <span className="mr-2 text-ink/40">·</span>
                      {renderInline(s, `${keyBase}-sli-${ix}-${sx}-`)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      );
      continue;
    }
    // Paragraph
    items.push(
      <p
        key={`${keyBase}-p-${i}`}
        className="my-2 text-[15px] leading-[1.6] text-ink"
      >
        {renderInline(trimmed, `${keyBase}-p-${i}-`)}
      </p>
    );
    i++;
  }
  return <>{items}</>;
}
