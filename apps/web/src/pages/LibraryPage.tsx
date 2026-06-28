import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Mermaid } from 'mermaid';
import { elsaToMermaid } from 'elsa-to-mermaid';
import { EXAMPLES, type ExampleWorkflow } from '../examples';

let mermaidPromise: Promise<Mermaid> | null = null;
function getMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        fontFamily: '"Geist Mono", ui-monospace, monospace',
        themeVariables: {
          background: '#F7F4EE',
          primaryColor: '#FFFCF6',
          primaryTextColor: '#0E0F12',
          primaryBorderColor: '#0E0F12',
          secondaryColor: '#FFFCF6',
          tertiaryColor: '#EDE8DC',
          lineColor: '#0E0F12',
          textColor: '#0E0F12',
          mainBkg: '#FFFCF6',
          nodeBorder: '#0E0F12',
          clusterBkg: 'rgba(138, 109, 59, 0.07)',
          clusterBorder: '#0E0F12',
          edgeLabelBackground: '#F7F4EE',
        },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

function swapSvg(host: HTMLElement, svgMarkup: string) {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const node = doc.documentElement;
  if (node.nodeName.toLowerCase() === 'parsererror') return;
  host.replaceChildren(document.importNode(node, true));
}

function downloadJson(ex: ExampleWorkflow) {
  const blob = new Blob([ex.json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ex.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function LibraryPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 sm:px-8 pt-16 sm:pt-20 pb-24">
      <div className="text-xs uppercase tracking-[0.22em] text-inkSoft">— Library</div>
      <h1 className="font-display text-4xl sm:text-5xl tracking-tight mt-3">
        Example workflows
      </h1>
      <p className="mt-5 max-w-2xl text-[16px] leading-[1.6] text-inkSoft">
        Each example is a real Elsa workflow definition. Open it in the converter to render
        the diagram, or download the JSON and drop it into your own Elsa project. The three
        workflows below illustrate the <em className="not-italic text-ember">Audit pattern</em> —
        a small, standardized envelope every workflow can use to report results.
        See <Link to="/adrs/0001-audit-pattern" className="underline decoration-ember/40 hover:decoration-ember">ADR-0001</Link> for the contract.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {EXAMPLES.map((ex) => (
          <ExampleCard key={ex.slug} example={ex} />
        ))}
      </div>
    </section>
  );
}

function ExampleCard({ example }: { example: ExampleWorkflow }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const code = await elsaToMermaid(example.json, { direction: 'TD' });
        if (cancelled) return;
        const mermaid = await getMermaid();
        const id = `lib-${example.slug}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(id, code);
        if (cancelled || !hostRef.current) return;
        swapSvg(hostRef.current, svg);
      } catch (e) {
        if (!cancelled) setRenderError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [example.json, example.slug]);

  return (
    <article className="rounded-2xl border border-ink/10 bg-paper shadow-inkSoft overflow-hidden flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {example.tags.map((t) => (
            <span
              key={t}
              className="inline-block text-[10px] uppercase tracking-[0.18em] text-inkSoft border border-ink/15 rounded-full px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
        <h2 className="font-display text-2xl tracking-tight leading-tight">{example.title}</h2>
        <p className="mt-2 text-[14px] text-inkSoft leading-[1.55]">{example.tagline}</p>
      </div>

      <div className="px-5 py-3 bg-paperDim/40 border-y border-ink/5 mermaid-host">
        {renderError ? (
          <div className="h-32 flex items-center justify-center text-[12px] text-ember px-4 text-center">
            Diagram failed to render: {renderError}
          </div>
        ) : (
          <div ref={hostRef} className="min-h-[180px] flex items-center justify-center" />
        )}
      </div>

      <div className="px-5 py-4">
        <p className="text-[13.5px] text-ink leading-[1.55]">{example.description}</p>
        {example.adrs && example.adrs.length > 0 && (
          <div className="mt-3 text-[12px] text-inkSoft">
            Related:{' '}
            {example.adrs.map((slug, i) => (
              <span key={slug}>
                {i > 0 && ', '}
                <Link to={`/adrs/${slug}`} className="underline decoration-ember/40 hover:decoration-ember">
                  ADR-{slug.split('-')[0]}
                </Link>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto px-5 py-3 border-t border-ink/5 bg-paperDim/30 flex items-center justify-between gap-2 flex-wrap">
        <Link
          to={{ pathname: '/', search: `?example=${example.slug}` }}
          state={{ scrollTo: 'convert' }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink text-paper hover:bg-ember transition-colors text-[12px] font-medium"
        >
          Open in editor →
        </Link>
        <button
          type="button"
          onClick={() => downloadJson(example)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink/15 hover:border-ink/40 text-[12px] text-ink transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M4 19h16" />
          </svg>
          Download JSON
        </button>
      </div>
    </article>
  );
}
