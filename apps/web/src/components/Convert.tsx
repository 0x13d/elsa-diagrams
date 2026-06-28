import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Mermaid } from 'mermaid';
import { elsaToCombined, elsaToMermaid, elsaToSpec } from 'elsa-to-mermaid';
import type { ConvertOptions } from 'elsa-to-mermaid';
import { SAMPLE_WORKFLOW } from '../sample';
import { getExample } from '../examples';
import { Paper } from './Paper';

type Direction = NonNullable<ConvertOptions['direction']>;
const DIRECTIONS: Direction[] = ['TD', 'LR', 'BT', 'RL'];

type ViewMode = 'diagram' | 'spec' | 'paper';
const VIEW_MODES: { id: ViewMode; label: string; sub: string }[] = [
  { id: 'paper', label: 'Paper', sub: 'Diagram + sidenotes' },
  { id: 'diagram', label: 'Diagram', sub: 'Mermaid only' },
  { id: 'spec', label: 'Spec', sub: 'Markdown' },
];

// Lazy-loaded — mermaid is large (~600KB pre-gzip) and not needed for the hero.
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
          edgeLabelBackground: '#F7F4EE'
        }
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

// Parse Mermaid's SVG output into an actual SVG element and swap it in.
// Avoids innerHTML; mermaid `securityLevel: 'strict'` already sanitizes labels,
// but using DOMParser keeps us safe even if that contract changes.
function swapSvg(host: HTMLElement, svgMarkup: string) {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const node = doc.documentElement;
  if (node.nodeName.toLowerCase() === 'parsererror') {
    throw new Error('Mermaid returned malformed SVG');
  }
  const imported = document.importNode(node, true);
  host.replaceChildren(imported);
}

function downloadFile(filename: string, content: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Convert() {
  const [searchParams, setSearchParams] = useSearchParams();
  const exampleSlug = searchParams.get('example');
  const initialInput = (() => {
    if (!exampleSlug) return SAMPLE_WORKFLOW;
    const ex = getExample(exampleSlug);
    return ex ? ex.json : SAMPLE_WORKFLOW;
  })();
  const [input, setInput] = useState(initialInput);
  const [direction, setDirection] = useState<Direction>('TD');
  const loadedExampleRef = useRef<string | null>(exampleSlug);

  // If the URL changes to a different ?example=, swap in that workflow.
  useEffect(() => {
    if (!exampleSlug || exampleSlug === loadedExampleRef.current) return;
    const ex = getExample(exampleSlug);
    if (ex) {
      setInput(ex.json);
      loadedExampleRef.current = exampleSlug;
    }
  }, [exampleSlug]);

  const resetToSample = () => {
    setInput(SAMPLE_WORKFLOW);
    if (exampleSlug) {
      const next = new URLSearchParams(searchParams);
      next.delete('example');
      setSearchParams(next, { replace: true });
    }
    loadedExampleRef.current = null;
  };
  const [view, setView] = useState<ViewMode>('paper');
  const [mermaidCode, setMermaidCode] = useState('');
  const [specMarkdown, setSpecMarkdown] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const diagramHostRef = useRef<HTMLDivElement>(null);

  const workflowName = useMemo(() => {
    try {
      const j = JSON.parse(input) as { name?: string; id?: string };
      const raw = j.name || j.id || 'workflow';
      return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow';
    } catch {
      return 'workflow';
    }
  }, [input]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [code, spec] = await Promise.all([
          elsaToMermaid(input, { direction }),
          elsaToSpec(input),
        ]);
        if (cancelled) return;
        setMermaidCode(code);
        setSpecMarkdown(spec);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setMermaidCode('');
        setSpecMarkdown('');
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [input, direction]);

  const renderDiagram = useCallback(async (host: HTMLElement, code: string) => {
    try {
      const mermaid = await getMermaid();
      const id = `m-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await mermaid.render(id, code);
      swapSvg(host, svg);
    } catch (e) {
      host.replaceChildren();
      setError(e instanceof Error ? e.message : 'Mermaid render failed');
    }
  }, []);

  // Render diagram into the inline 'diagram' view host whenever code changes.
  useEffect(() => {
    if (view !== 'diagram') return;
    if (!mermaidCode || !diagramHostRef.current) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await renderDiagram(diagramHostRef.current!, mermaidCode);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, mermaidCode, renderDiagram]);

  const handleCopy = async () => {
    const text = view === 'spec' ? specMarkdown : mermaidCode;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const downloadDiagram = () => {
    if (!mermaidCode) return;
    downloadFile(`${workflowName}.mmd`, mermaidCode, 'text/plain');
    setDownloadsOpen(false);
  };

  const downloadSpec = () => {
    if (!specMarkdown) return;
    downloadFile(`${workflowName}.spec.md`, specMarkdown);
    setDownloadsOpen(false);
  };

  const downloadCombined = async () => {
    if (!input) return;
    try {
      const combined = await elsaToCombined(input, { direction });
      downloadFile(`${workflowName}.paper.md`, combined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setDownloadsOpen(false);
  };

  const downloadPrintable = () => {
    setDownloadsOpen(false);
    setTimeout(() => window.print(), 0);
  };

  return (
    <section id="convert" className="mx-auto max-w-6xl px-6 sm:px-8 pb-24">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-inkSoft">02 — Converter</div>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mt-1">
            Paste, preview, download.
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-inkSoft mr-1">Direction</span>
          <div className="inline-flex rounded-full border border-ink/15 bg-paper p-0.5 text-xs">
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-3 py-1 rounded-full transition-colors ${
                  direction === d ? 'bg-ink text-paper' : 'text-inkSoft hover:text-ink'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5">
        <div className="rounded-2xl border border-ink/10 bg-paper shadow-inkSoft overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink/10 bg-paperDim/60">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-inkSoft">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-ember" />
              Workflow JSON
            </div>
            <button
              onClick={resetToSample}
              className="text-[11px] uppercase tracking-[0.18em] text-inkSoft hover:text-ember transition-colors"
            >
              Reset sample
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-full h-[520px] resize-none p-5 font-mono text-[12.5px] leading-[1.65] bg-transparent text-ink focus:outline-none placeholder:text-inkSoft/60"
            placeholder="Paste an Elsa v2 or v3 workflow JSON…"
          />
        </div>

        <div className="rounded-2xl border border-ink/10 bg-paper shadow-inkSoft overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-ink/10 bg-paperDim/60 flex-wrap">
            <div className="inline-flex rounded-full border border-ink/15 bg-paper p-0.5 text-[11px]">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setView(m.id)}
                  className={`px-3 py-1 rounded-full transition-colors uppercase tracking-[0.16em] ${
                    view === m.id ? 'bg-ink text-paper' : 'text-inkSoft hover:text-ink'
                  }`}
                  title={m.sub}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] relative">
              <button
                onClick={handleCopy}
                disabled={view === 'paper' ? !mermaidCode : view === 'spec' ? !specMarkdown : !mermaidCode}
                className="text-inkSoft hover:text-ink disabled:opacity-40 transition-colors"
              >
                {copied ? 'Copied' : view === 'spec' ? 'Copy spec' : 'Copy code'}
              </button>
              <DownloadsMenu
                open={downloadsOpen}
                onToggle={() => setDownloadsOpen((v) => !v)}
                onClose={() => setDownloadsOpen(false)}
                items={[
                  { label: 'Mermaid diagram (.mmd)', sub: 'Raw flowchart source', onClick: downloadDiagram, disabled: !mermaidCode },
                  { label: 'Spec sheet (.md)', sub: 'Per-activity details', onClick: downloadSpec, disabled: !specMarkdown },
                  { label: 'Combined paper (.md)', sub: 'Diagram + spec, fenced', onClick: downloadCombined, disabled: !specMarkdown },
                  { label: 'Print paper…', sub: 'Tufte-style PDF via browser', onClick: downloadPrintable, disabled: !specMarkdown },
                ]}
              />
            </div>
          </div>

          <div className="flex-1 min-h-[520px] overflow-auto">
            {error ? (
              <div className="h-full flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-ember mb-2">
                    Parse error
                  </div>
                  <pre className="text-sm font-mono text-inkSoft whitespace-pre-wrap text-pretty">
                    {error}
                  </pre>
                </div>
              </div>
            ) : view === 'diagram' ? (
              <div className="h-full p-6 mermaid-host grain bg-[radial-gradient(rgba(14,15,18,0.05)_1px,transparent_1px)] [background-size:18px_18px]">
                <div ref={diagramHostRef} className="h-full flex items-center justify-center" />
              </div>
            ) : view === 'spec' ? (
              <pre className="px-6 py-5 font-mono text-[12.5px] leading-[1.65] text-ink whitespace-pre-wrap break-words">
                {specMarkdown || '(no output)'}
              </pre>
            ) : (
              <div className="px-6 py-5">
                <Paper
                  mermaidCode={mermaidCode}
                  specMarkdown={specMarkdown}
                  renderDiagram={renderDiagram}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden region used only for window.print() — always renders the paper view. */}
      <div className="paper-print-root">
        {!error && specMarkdown && (
          <Paper
            mermaidCode={mermaidCode}
            specMarkdown={specMarkdown}
            renderDiagram={renderDiagram}
          />
        )}
      </div>
    </section>
  );
}

interface DownloadItem {
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}

function DownloadsMenu({
  open,
  onToggle,
  onClose,
  items,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: DownloadItem[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className="text-inkSoft hover:text-ember transition-colors flex items-center gap-1"
      >
        Download ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-ink/15 bg-paper shadow-lg overflow-hidden z-10">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              disabled={it.disabled}
              className="w-full text-left px-4 py-3 border-b border-ink/5 last:border-b-0 hover:bg-paperDim/60 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <div className="text-[12.5px] text-ink normal-case tracking-normal font-medium">
                {it.label}
              </div>
              <div className="text-[11px] text-inkSoft normal-case tracking-normal mt-0.5">
                {it.sub}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
