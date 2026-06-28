import * as vscode from 'vscode';
import { MermaidPreview } from './preview.js';
import { detectElsaWorkflow } from './detect.js';

const previews = new Map<string, MermaidPreview>();

function setWorkflowContext(doc: vscode.TextDocument | undefined): void {
  const isWorkflow = !!doc && doc.languageId === 'json' && detectElsaWorkflow(doc.getText()) !== null;
  void vscode.commands.executeCommand('setContext', 'elsaToMermaid.isWorkflowJson', isWorkflow);
}

function openPreview(context: vscode.ExtensionContext, toSide: boolean): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage('Open an Elsa workflow JSON file first.');
    return;
  }
  const document = editor.document;
  const key = document.uri.toString();
  const column = toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;

  const existing = previews.get(key);
  if (existing) {
    existing.reveal(column);
    return;
  }

  const preview = new MermaidPreview(context, document, column);
  previews.set(key, preview);
  // When the preview disposes (user closes the panel or document closes),
  // drop it from the map so the next open creates fresh.
  const cleanup = vscode.workspace.onDidCloseTextDocument((closed) => {
    if (closed.uri.toString() === key) {
      previews.delete(key);
      cleanup.dispose();
    }
  });
  context.subscriptions.push(cleanup);
}

async function exportToMarkdown(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage('Open an Elsa workflow JSON file first.');
    return;
  }
  const { convert } = await import('./convert.js');
  const direction = vscode.workspace
    .getConfiguration('elsaToMermaid')
    .get<'TD' | 'LR' | 'BT' | 'RL'>('defaultDirection', 'TD');

  let mermaid: string;
  try {
    mermaid = convert(editor.document.getText(), direction);
  } catch (e) {
    void vscode.window.showErrorMessage(
      `Conversion failed: ${e instanceof Error ? e.message : String(e)}`
    );
    return;
  }

  let workflowName = 'workflow';
  try {
    const j = JSON.parse(editor.document.getText()) as { name?: string; id?: string };
    const raw = (j.name || j.id || 'workflow').toString();
    workflowName = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow';
  } catch {
    /* fall through with default name */
  }

  const md = `# ${workflowName}\n\n\`\`\`mermaid\n${mermaid}\`\`\`\n`;
  const defaultUri = vscode.Uri.file(editor.document.uri.fsPath.replace(/\.json$/i, '') + '.md');
  const target = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { Markdown: ['md'] },
    title: 'Export Mermaid as Markdown'
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(md, 'utf8'));
  void vscode.window.showInformationMessage(`Wrote ${target.fsPath}`);
}

export function activate(context: vscode.ExtensionContext): void {
  setWorkflowContext(vscode.window.activeTextEditor?.document);

  context.subscriptions.push(
    vscode.commands.registerCommand('elsaToMermaid.openPreview', () => openPreview(context, false)),
    vscode.commands.registerCommand('elsaToMermaid.openPreviewToSide', () => openPreview(context, true)),
    vscode.commands.registerCommand('elsaToMermaid.exportToMarkdown', () => exportToMarkdown()),
    vscode.window.onDidChangeActiveTextEditor((e) => setWorkflowContext(e?.document)),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === vscode.window.activeTextEditor?.document) {
        setWorkflowContext(e.document);
      }
    })
  );
}

export function deactivate(): void {
  for (const p of previews.values()) p.dispose();
  previews.clear();
}
