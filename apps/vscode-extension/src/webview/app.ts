/// <reference lib="dom" />

import mermaid from 'mermaid';
import { parseSpec, type SpecBlock, type SpecSection } from './parseSpec.js';

type Direction = 'TD' | 'LR' | 'BT' | 'RL';
type ViewMode = 'paper' | 'diagram' | 'spec';
type ExportKind = 'mermaid' | 'spec' | 'combined';

interface RenderPayload {
  status: 'ok' | 'not-elsa' | 'error';
  diagramName: string;
  mermaid?: string;
  spec?: string;
  direction: Direction;
  message?: string;
}

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;
const vscode = acquireVsCodeApi();

let mermaidInit = false;
function ensureMermaid(): void {
  if (mermaidInit) return;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'base',
    fontFamily: 'var(--vscode-editor-font-family), ui-monospace, monospace',
    themeVariables: dark
      ? {
          background: 'transparent',
          primaryColor: '#1f2024',
          primaryTextColor: '#e6e6e6',
          primaryBorderColor: '#a3a3a3',
          lineColor: '#a3a3a3',
          clusterBkg: 'rgba(255,255,255,0.05)',
          clusterBorder: '#a3a3a3'
        }
      : {
          background: 'transparent',
          primaryColor: '#FFFCF6',
          primaryTextColor: '#0E0F12',
          primaryBorderColor: '#0E0F12',
          lineColor: '#0E0F12',
          clusterBkg: 'rgba(217, 75, 23, 0.07)',
          clusterBorder: '#0E0F12'
        }
  });
  mermaidInit = true;
}

const root = document.getElementById('root') as HTMLElement;
const directionGroup = document.getElementById('direction') as HTMLElement;
const viewGroup = document.getElementById('view') as HTMLElement;
const exportBtn = document.getElementById('export') as HTMLButtonElement;
const exportMenu = document.getElementById('export-menu') as HTMLElement;

let currentView: ViewMode = 'paper';
let lastPayload: RenderPayload | null = null;

function setDirectionState(dir: Direction): void {
  for (const btn of directionGroup.querySelectorAll<HTMLButtonElement>('button[data-d]')) {
    btn.setAttribute('aria-pressed', btn.dataset.d === dir ? 'true' : 'false');
  }
}

function setViewState(v: ViewMode): void {
  for (const btn of viewGroup.querySelectorAll<HTMLButtonElement>('button[data-v]')) {
    btn.setAttribute('aria-pressed', btn.dataset.v === v ? 'true' : 'false');
  }
}

directionGroup.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const btn = target.closest('button[data-d]') as HTMLButtonElement | null;
  if (!btn) return;
  const dir = btn.dataset.d as Direction;
  vscode.postMessage({ type: 'setDirection', direction: dir });
});

viewGroup.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const btn = target.closest('button[data-v]') as HTMLButtonElement | null;
  if (!btn) return;
  currentView = btn.dataset.v as ViewMode;
  setViewState(currentView);
  if (lastPayload) void render(lastPayload);
});

exportBtn.addEventListener('click', () => {
  exportMenu.hidden = !exportMenu.hidden;
});
document.addEventListener('click', (event) => {
  if (exportMenu.hidden) return;
  const path = event.composedPath();
  if (!path.includes(exportBtn) && !path.includes(exportMenu)) {
    exportMenu.hidden = true;
  }
});
exportMenu.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const btn = target.closest('button[data-kind]') as HTMLButtonElement | null;
  if (!btn) return;
  const kind = btn.dataset.kind as ExportKind;
  vscode.postMessage({ type: 'export', kind });
  exportMenu.hidden = true;
});

function showEmpty(message: string): void {
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = message;
  root.classList.add('center');
  root.replaceChildren(p);
}

function showError(message: string): void {
  const wrap = document.createElement('div');
  wrap.style.maxWidth = '60ch';
  wrap.style.textAlign = 'center';
  const title = document.createElement('div');
  title.className = 'label accent';
  title.textContent = 'Parse error';
  title.style.marginBottom = '8px';
  const pre = document.createElement('pre');
  pre.className = 'error';
  pre.textContent = message;
  wrap.append(title, pre);
  root.classList.add('center');
  root.replaceChildren(wrap);
}

function swapSvg(host: HTMLElement, svgMarkup: string): void {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const node = doc.documentElement;
  if (node.nodeName.toLowerCase() === 'parsererror') {
    showError('Mermaid returned malformed SVG');
    return;
  }
  host.replaceChildren(document.importNode(node, true));
}

let renderToken = 0;
async function renderMermaidInto(host: HTMLElement, code: string): Promise<void> {
  ensureMermaid();
  const token = ++renderToken;
  try {
    const id = `m-${Math.random().toString(36).slice(2, 9)}`;
    const { svg } = await mermaid.render(id, code);
    if (token !== renderToken) return;
    swapSvg(host, svg);
  } catch (e) {
    if (token !== renderToken) return;
    showError(e instanceof Error ? e.message : 'Mermaid render failed');
  }
}

async function render(payload: RenderPayload): Promise<void> {
  lastPayload = payload;
  setDirectionState(payload.direction);
  setViewState(currentView);

  if (payload.status === 'not-elsa') {
    showEmpty(payload.message ?? 'Not an Elsa workflow.');
    return;
  }
  if (payload.status === 'error' || !payload.mermaid) {
    showError(payload.message ?? 'Conversion failed.');
    return;
  }

  if (currentView === 'diagram') {
    root.classList.add('center');
    const host = document.createElement('div');
    host.className = 'host';
    root.replaceChildren(host);
    await renderMermaidInto(host, payload.mermaid);
    return;
  }

  if (currentView === 'spec') {
    root.classList.remove('center');
    const pre = document.createElement('pre');
    pre.className = 'raw';
    pre.textContent = payload.spec ?? '(no spec generated)';
    root.replaceChildren(pre);
    return;
  }

  // Paper view
  root.classList.remove('center');
  if (!payload.spec) {
    showEmpty('Spec sheet unavailable.');
    return;
  }
  const paper = buildPaper(payload.spec);
  root.replaceChildren(paper.article);
  if (paper.diagramHost && payload.mermaid) {
    await renderMermaidInto(paper.diagramHost, payload.mermaid);
  }
}

window.addEventListener('message', (event) => {
  const data = event.data as { type?: string; payload?: RenderPayload };
  if (data?.type === 'render' && data.payload) {
    void render(data.payload);
  }
});

setViewState(currentView);
vscode.postMessage({ type: 'ready' });
showEmpty('Waiting for workflow…');

// ---------------------------------------------------------------------------
// Tufte paper DOM builder
// ---------------------------------------------------------------------------

interface BuiltPaper {
  article: HTMLElement;
  diagramHost: HTMLElement | null;
}

function buildPaper(specMarkdown: string): BuiltPaper {
  const parsed = parseSpec(specMarkdown);
  const article = document.createElement('article');
  article.className = 'tufte-paper';

  const header = document.createElement('header');
  const sub = document.createElement('div');
  sub.className = 'label';
  sub.textContent = 'Workflow specification';
  header.append(sub);
  const h1 = document.createElement('h1');
  h1.className = 'display';
  h1.textContent = parsed.meta.title || 'Workflow';
  header.append(h1);
  if (parsed.meta.chips.length > 0) {
    const chips = document.createElement('p');
    chips.className = 'chips';
    appendChips(chips, parsed.meta.chips);
    header.append(chips);
  }
  article.append(header);

  const figure = document.createElement('figure');
  figure.className = 'figure';
  const host = document.createElement('div');
  host.className = 'host';
  figure.append(host);
  const caption = document.createElement('figcaption');
  caption.className = 'figure-caption';
  caption.textContent = 'Figure 1 · Flow diagram';
  figure.append(caption);
  article.append(figure);

  const h2 = document.createElement('h2');
  h2.className = 'display';
  h2.textContent = 'Activities';
  article.append(h2);
  const intro = document.createElement('p');
  intro.className = 'chips';
  intro.textContent = 'Per-activity detail. Configuration appears in the margin.';
  article.append(intro);

  for (const sec of parsed.sections) {
    article.append(renderSection(sec));
  }

  return { article, diagramHost: host };
}

function renderSection(section: SpecSection): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = `tufte-activity depth-${section.depth}`;
  wrap.setAttribute('data-elsa-id', section.id);

  const main = document.createElement('div');
  main.className = 'tufte-main';
  const h3 = document.createElement('h3');
  h3.className = 'display';
  h3.textContent = section.title;
  main.append(h3);
  if (section.chips.length > 0) {
    const chips = document.createElement('p');
    chips.className = 'chips';
    appendChips(chips, section.chips);
    main.append(chips);
  }

  const flow = section.blocks.find((b) => b.heading === 'Flow');
  const config = section.blocks.find((b) => b.heading === 'Configuration');
  const propertyBlock = section.blocks.find(
    (b) => b.heading !== 'Flow' && b.heading !== 'Configuration' && b.heading !== 'Notes'
  );
  const notes = section.blocks.find((b) => b.heading === 'Notes');

  if (flow) main.append(renderBlock(flow));
  if (notes) main.append(renderBlock(notes));
  if (section.isComposite) {
    const c = document.createElement('p');
    c.className = 'label';
    c.textContent = 'Composite — inner steps follow.';
    main.append(c);
  }

  const aside = document.createElement('aside');
  aside.className = 'tufte-margin';
  if (propertyBlock) aside.append(renderSidenote(propertyBlock));
  if (config) aside.append(renderSidenote(config));

  wrap.append(main, aside);
  return wrap;
}

function renderSidenote(block: SpecBlock): HTMLElement {
  const note = document.createElement('div');
  note.className = 'tufte-sidenote';
  const title = document.createElement('span');
  title.className = 'sn-title';
  title.textContent = block.heading;
  note.append(title);
  note.append(renderBody(block.body));
  return note;
}

function renderBlock(block: SpecBlock): HTMLElement {
  const wrap = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'label';
  title.textContent = block.heading;
  title.style.marginTop = '0.75rem';
  wrap.append(title);
  wrap.append(renderBody(block.body));
  return wrap;
}

function renderBody(lines: string[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const pre = document.createElement('pre');
      pre.textContent = buf.join('\n');
      frag.append(pre);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const ul = document.createElement('ul');
      ul.className = 'tufte-list';
      while (i < lines.length) {
        const m = lines[i].match(/^[-*]\s+(.*)$/);
        if (!m) break;
        const li = document.createElement('li');
        appendInline(li, m[1]);
        i++;
        // Sub-bullets
        const subs: string[] = [];
        while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
          const sm = lines[i].match(/^\s+[-*]\s+(.*)$/);
          if (sm) subs.push(sm[1]);
          i++;
        }
        if (subs.length > 0) {
          const sub = document.createElement('ul');
          for (const s of subs) {
            const sli = document.createElement('li');
            appendInline(sli, s);
            sub.append(sli);
          }
          li.append(sub);
        }
        ul.append(li);
      }
      frag.append(ul);
      continue;
    }
    const p = document.createElement('p');
    appendInline(p, trimmed);
    frag.append(p);
    i++;
  }
  return frag;
}

function appendChips(host: HTMLElement, chips: string[]): void {
  chips.forEach((chip, i) => {
    appendInline(host, chip);
    if (i < chips.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = ' · ';
      sep.style.opacity = '0.5';
      host.append(sep);
    }
  });
}

function appendInline(host: HTMLElement, text: string): void {
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) {
      host.append(document.createTextNode(buf));
      buf = '';
    }
  };
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '**') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        const strong = document.createElement('strong');
        strong.textContent = text.slice(i + 2, end);
        host.append(strong);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        const code = document.createElement('code');
        code.textContent = text.slice(i + 1, end);
        host.append(code);
        i = end + 1;
        continue;
      }
    }
    if ((text[i] === '*' || text[i] === '_') && text[i + 1] !== text[i]) {
      const end = text.indexOf(text[i], i + 1);
      if (end !== -1 && end !== i + 1) {
        flush();
        const em = document.createElement('em');
        em.textContent = text.slice(i + 1, end);
        host.append(em);
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
}
