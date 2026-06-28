import { Fragment, type ReactNode } from 'react';
import { renderBody, renderInline } from './renderInline';

const HEADING = /^(#{1,6})\s+(.*)$/;

/**
 * Render a small subset of CommonMark sufficient for ADRs and similar prose:
 * H1-H4 headings, paragraphs, bullet/sub-bullet lists, fenced code blocks,
 * and inline bold/italic/code. Anything fancier passes through verbatim.
 */
export function renderMarkdown(md: string, keyBase = 'md'): ReactNode {
  const lines = md.split('\n');
  const out: ReactNode[] = [];
  let buf: string[] = [];

  const flushBody = (suffix: string) => {
    if (buf.length === 0) return;
    out.push(
      <Fragment key={`${keyBase}-b-${suffix}`}>{renderBody(buf, `${keyBase}-b-${suffix}`)}</Fragment>
    );
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(HEADING);
    if (m) {
      flushBody(`pre-${i}`);
      const depth = m[1].length;
      const text = m[2].trim();
      out.push(renderHeading(depth, text, `${keyBase}-h-${i}`));
      continue;
    }
    buf.push(line);
  }
  flushBody('end');

  return <>{out}</>;
}

function renderHeading(depth: number, text: string, key: string): ReactNode {
  const inline = renderInline(text, `${key}-`);
  if (depth === 1) {
    return (
      <h1
        key={key}
        className="font-display text-3xl sm:text-4xl tracking-tight mt-6 first:mt-0 mb-3 text-balance"
      >
        {inline}
      </h1>
    );
  }
  if (depth === 2) {
    return (
      <h2
        key={key}
        className="font-display text-xl sm:text-2xl tracking-tight mt-10 mb-2 text-ink border-b border-ink/10 pb-1"
      >
        {inline}
      </h2>
    );
  }
  if (depth === 3) {
    return (
      <h3 key={key} className="font-display text-lg tracking-tight mt-7 mb-1.5 text-ink">
        {inline}
      </h3>
    );
  }
  return (
    <h4
      key={key}
      className="font-sans text-[13px] uppercase tracking-[0.18em] text-inkSoft mt-5 mb-1"
    >
      {inline}
    </h4>
  );
}
