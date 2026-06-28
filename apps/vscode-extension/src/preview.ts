import * as vscode from 'vscode';
import { convert, convertCombined, convertSpec, type Direction } from './convert.js';
import { detectElsaWorkflow } from './detect.js';

const VIEW_TYPE = 'elsaToMermaid.preview';

type ExportKind = 'mermaid' | 'spec' | 'combined';

interface Payload {
  status: 'ok' | 'not-elsa' | 'error';
  diagramName: string;
  mermaid?: string;
  spec?: string;
  direction: Direction;
  message?: string;
}

function workflowName(jsonText: string): string {
  try {
    const j = JSON.parse(jsonText) as { name?: string; id?: string };
    const raw = (j.name || j.id || 'workflow').toString();
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow';
  } catch {
    return 'workflow';
  }
}

function buildPayload(jsonText: string, direction: Direction): Payload {
  const diagramName = workflowName(jsonText);
  const detected = detectElsaWorkflow(jsonText);
  if (!detected) {
    return {
      status: 'not-elsa',
      direction,
      diagramName,
      message: 'This file does not look like an Elsa workflow (v2 or v3).'
    };
  }
  try {
    const mermaid = convert(jsonText, direction);
    const spec = convertSpec(jsonText);
    return { status: 'ok', direction, diagramName, mermaid, spec };
  } catch (e) {
    return {
      status: 'error',
      direction,
      diagramName,
      message: e instanceof Error ? e.message : String(e)
    };
  }
}

export class MermaidPreview {
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private direction: Direction;
  private debounceTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private document: vscode.TextDocument,
    column: vscode.ViewColumn
  ) {
    this.direction = vscode.workspace
      .getConfiguration('elsaToMermaid')
      .get<Direction>('defaultDirection', 'TD');

    this.panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      this.title(),
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist'), vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    this.panel.webview.html = this.renderHtml();
    this.registerListeners();
    this.update();
  }

  static getViewType(): string {
    return VIEW_TYPE;
  }

  reveal(column: vscode.ViewColumn): void {
    this.panel.reveal(column);
  }

  isFor(uri: vscode.Uri): boolean {
    return this.document.uri.toString() === uri.toString();
  }

  dispose(): void {
    this.panel.dispose();
    for (const d of this.disposables.splice(0)) d.dispose();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private title(): string {
    return `Preview · ${this.document.fileName.split(/[\\/]/).pop() ?? 'workflow.json'}`;
  }

  private registerListeners(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === this.document.uri.toString()) {
          this.scheduleUpdate();
        }
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        if (doc.uri.toString() === this.document.uri.toString()) {
          this.dispose();
        }
      }),
      this.panel.webview.onDidReceiveMessage((msg) => this.onWebviewMessage(msg)),
      this.panel.onDidDispose(() => this.dispose())
    );
  }

  private onWebviewMessage(msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return;
    const m = msg as { type?: string; direction?: Direction; kind?: ExportKind };
    switch (m.type) {
      case 'ready':
        this.update();
        break;
      case 'setDirection':
        if (m.direction && ['TD', 'LR', 'BT', 'RL'].includes(m.direction)) {
          this.direction = m.direction;
          this.update();
        }
        break;
      case 'export':
        if (m.kind) void this.exportFile(m.kind);
        break;
      // Back-compat with prior message name
      case 'exportMd':
        void this.exportFile('combined');
        break;
    }
  }

  private scheduleUpdate(): void {
    const ms = vscode.workspace
      .getConfiguration('elsaToMermaid')
      .get<number>('previewDebounceMs', 200);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.update(), ms);
  }

  private update(): void {
    const payload = buildPayload(this.document.getText(), this.direction);
    void this.panel.webview.postMessage({ type: 'render', payload });
  }

  private async exportFile(kind: ExportKind): Promise<void> {
    const text = this.document.getText();
    const detected = detectElsaWorkflow(text);
    if (!detected) {
      void vscode.window.showWarningMessage(
        'Nothing to export — the current document is not a recognised Elsa workflow.'
      );
      return;
    }
    let content: string;
    let suffix: string;
    let filters: { [name: string]: string[] };
    try {
      switch (kind) {
        case 'mermaid':
          content = convert(text, this.direction);
          suffix = '.mmd';
          filters = { Mermaid: ['mmd'], Text: ['txt'] };
          break;
        case 'spec':
          content = convertSpec(text);
          suffix = '.spec.md';
          filters = { Markdown: ['md'] };
          break;
        case 'combined':
        default:
          content = convertCombined(text, this.direction);
          suffix = '.paper.md';
          filters = { Markdown: ['md'] };
          break;
      }
    } catch (e) {
      void vscode.window.showErrorMessage(
        e instanceof Error ? e.message : 'Conversion failed.'
      );
      return;
    }
    const defaultUri = vscode.Uri.file(
      this.document.uri.fsPath.replace(/\.json$/i, '') + suffix
    );
    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters,
      title:
        kind === 'mermaid'
          ? 'Export Mermaid diagram'
          : kind === 'spec'
          ? 'Export spec sheet'
          : 'Export combined paper'
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    void vscode.window.showInformationMessage(`Wrote ${target.fsPath}`);
  }

  private renderHtml(): string {
    const nonce = randomNonce();
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const cspSource = webview.cspSource;

    return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource}; script-src 'nonce-${nonce}';" />
<title>Elsa Mermaid Preview</title>
<style>
  :root { color-scheme: var(--vscode-color-scheme, light dark); }
  html, body { height: 100%; margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--vscode-panel-border); position: sticky; top: 0; background: var(--vscode-editor-background); z-index: 2; }
  .topbar .group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--vscode-descriptionForeground); }
  .seg { display: inline-flex; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 999px; padding: 2px; }
  .seg button { all: unset; cursor: pointer; padding: 2px 10px; border-radius: 999px; font-size: 11px; color: var(--vscode-descriptionForeground); }
  .seg button[aria-pressed="true"] { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .seg button:focus-visible { outline: 1px solid var(--vscode-focusBorder); }
  .btn { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 4px; font-size: 11px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  .btn:hover { background: var(--vscode-button-hoverBackground); }
  .menu { position: relative; }
  .menu-list { position: absolute; right: 0; top: calc(100% + 4px); min-width: 240px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; box-shadow: 0 8px 28px rgba(0,0,0,0.2); padding: 4px; z-index: 5; }
  .menu-list button { all: unset; cursor: pointer; display: block; width: 100%; padding: 8px 10px; border-radius: 4px; color: var(--vscode-foreground); font-size: 12px; }
  .menu-list button:hover { background: var(--vscode-list-hoverBackground); }
  .menu-list .sub { display: block; font-size: 10.5px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
  main { padding: 20px; min-height: calc(100% - 56px); }
  .host { width: 100%; }
  .host svg { width: 100%; height: auto; display: block; }
  .center { display: flex; align-items: center; justify-content: center; }
  .empty { color: var(--vscode-descriptionForeground); text-align: center; max-width: 36ch; line-height: 1.5; }
  .error { color: var(--vscode-errorForeground); white-space: pre-wrap; font-family: var(--vscode-editor-font-family); font-size: 12px; max-width: 60ch; }
  .accent { color: var(--vscode-textLink-foreground); }
  pre.raw { white-space: pre-wrap; font-family: var(--vscode-editor-font-family); font-size: 12.5px; line-height: 1.55; color: var(--vscode-editor-foreground); margin: 0; }

  /* Tufte-paper layout */
  .tufte-paper { max-width: 1100px; margin: 0 auto; --tufte-margin: 240px; --tufte-gap: 2rem; font-family: var(--vscode-editor-font-family, serif); }
  .tufte-paper .display { font-family: Georgia, "Times New Roman", serif; }
  .tufte-paper h1 { font-size: 1.8rem; line-height: 1.1; margin: 0 0 0.5rem 0; }
  .tufte-paper h2 { font-size: 1.4rem; line-height: 1.15; margin: 1.75rem 0 0.5rem 0; }
  .tufte-paper h3 { font-size: 1.15rem; line-height: 1.2; margin: 0; }
  .tufte-paper p { margin: 0.4rem 0; }
  .tufte-paper code { background: var(--vscode-textBlockQuote-background); padding: 0 4px; border-radius: 3px; font-size: 0.86em; }
  .tufte-paper pre { background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 6px; overflow-x: auto; }
  .tufte-paper .chips { color: var(--vscode-descriptionForeground); font-size: 12px; }
  .tufte-paper .figure { margin: 1.25rem 0 0.25rem 0; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 1rem; }
  .tufte-paper .figure-caption { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-top: 0.5rem; }
  .tufte-activity { display: grid; grid-template-columns: minmax(0, 1fr) var(--tufte-margin); column-gap: var(--tufte-gap); align-items: start; margin: 1.5rem 0; }
  .tufte-main { max-width: 70ch; }
  .tufte-margin { font-size: 12px; line-height: 1.55; color: var(--vscode-descriptionForeground); display: flex; flex-direction: column; gap: 0.85rem; padding-top: 2px; }
  .tufte-sidenote { padding-left: 0.75rem; border-left: 2px solid var(--vscode-textLink-foreground); }
  .tufte-sidenote + .tufte-sidenote { border-left-color: var(--vscode-panel-border); }
  .tufte-sidenote .sn-title { display: block; text-transform: uppercase; letter-spacing: 0.18em; font-size: 10px; color: var(--vscode-textLink-foreground); margin-bottom: 4px; }
  .tufte-sidenote + .tufte-sidenote .sn-title { color: var(--vscode-descriptionForeground); }
  ul.tufte-list { list-style: none; padding-left: 0; margin: 0.4rem 0; }
  ul.tufte-list li { margin: 0.2rem 0; }
  ul.tufte-list li::before { content: "·"; margin-right: 8px; color: var(--vscode-textLink-foreground); }
  ul.tufte-list ul { list-style: none; padding-left: 16px; margin: 4px 0; color: var(--vscode-descriptionForeground); }
  @media (max-width: 900px) {
    .tufte-paper { --tufte-margin: 0; --tufte-gap: 0; }
    .tufte-activity { grid-template-columns: 1fr; row-gap: 0.5rem; }
    .tufte-margin { border-top: 1px dashed var(--vscode-panel-border); padding-top: 0.5rem; }
  }
</style>
</head>
<body>
<div class="topbar">
  <div class="group">
    <span class="label">View</span>
    <div class="seg" role="radiogroup" id="view">
      <button role="radio" data-v="paper">Paper</button>
      <button role="radio" data-v="diagram">Diagram</button>
      <button role="radio" data-v="spec">Spec</button>
    </div>
  </div>
  <div class="group">
    <span class="label">Direction</span>
    <div class="seg" role="radiogroup" id="direction">
      <button role="radio" data-d="TD">TD</button>
      <button role="radio" data-d="LR">LR</button>
      <button role="radio" data-d="BT">BT</button>
      <button role="radio" data-d="RL">RL</button>
    </div>
    <div class="menu">
      <button class="btn" id="export">Export ▾</button>
      <div class="menu-list" id="export-menu" hidden>
        <button data-kind="mermaid">Mermaid diagram (.mmd)<span class="sub">Raw flowchart source</span></button>
        <button data-kind="spec">Spec sheet (.md)<span class="sub">Per-activity details</span></button>
        <button data-kind="combined">Combined paper (.md)<span class="sub">Diagram + spec, fenced</span></button>
      </div>
    </div>
  </div>
</div>
<main><div id="root" class="host center"></div></main>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function randomNonce(): string {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
