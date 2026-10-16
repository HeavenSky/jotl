// 预览面板(E6): 命令 `jotl.showPreview` 在编辑器旁打开 webview, 展示当前 Jotl 文档的 JSON Schema, TS 与表单预览, 随编辑与切换编辑器更新;
// 设置 `jotl.preview.loadWidgetModules` 开启时把扩展组件模块的来源放进 CSP 与 localResourceRoots.
import { dirname } from "node:path";
import type { PreviewContent } from "@jotl/language-server";
import { commands, type Disposable, env, l10n, type TextDocument, Uri, ViewColumn, type WebviewPanel, window, workspace } from "vscode";
import { localModulePath, schemaModuleImports } from "./preview-config.js";
import { createNonce, renderPreviewHtml } from "./preview-html.js";
import { LOAD_WIDGET_MODULES_SETTING, type PreviewModules, SHARED_MODULE_SHIMS, type WidgetModuleRef } from "./preview-modules.js";
import { isFromWebview, type ToWebview } from "./preview-protocol.js";
import { createPreviewText, formatText, type PreviewText } from "./preview-text.js";

/** 必须等于 package.json 中 `contributes.commands` 声明的命令名. */
export const SHOW_PREVIEW_COMMAND = "jotl.showPreview";
export const PREVIEW_VIEW_TYPE = "jotl.preview";
/** 必须等于打包脚本中预览脚本与表单样式的输出目录与文件名. */
const SCRIPT_DIR = "dist";
const SCRIPT_FILE = "preview.js";
const FORM_STYLE_FILE = "preview-form.css";
const LANGUAGE_ID = "jotl";
const UPDATE_DELAY_MS = 200;
const CONFIGURATION_SECTION = "jotl";

export type RequestPreview = (uri: string) => Promise<PreviewContent | null>;
export type Log = (message: string) => void;
/** 订阅语言服务处理完 jotl.config.json 变更后的通知. */
export type OnConfigChanged = (listener: () => void) => Disposable;

class PreviewController implements Disposable {
  private panel: WebviewPanel | undefined;
  private document: TextDocument | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** 只投递最后一次请求的结果, 防止慢响应覆盖新内容. */
  private sequence = 0;
  /** 当前 HTML 外壳对应的模块开关与本地资源目录; 变化时重建外壳. */
  private shellKey = "";
  private readonly subscriptions: Disposable[];

  constructor(
    private readonly extensionUri: Uri,
    private readonly request: RequestPreview,
    private readonly log: Log,
    private readonly text: PreviewText,
    onConfigChanged: OnConfigChanged,
  ) {
    this.subscriptions = [
      workspace.onDidChangeTextDocument(({ document }) => {
        if (document === this.document) this.schedule();
      }),
      window.onDidChangeActiveTextEditor((editor) => {
        const document = editor?.document;
        if (this.panel !== undefined && document?.languageId === LANGUAGE_ID && document !== this.document) this.show(document, false);
      }),
      workspace.onDidCloseTextDocument((document) => {
        if (document !== this.document) return;
        this.cancel();
        this.post({ type: "unavailable", fileName: fileName(document), reason: this.text.documentClosed });
      }),
      workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(`${CONFIGURATION_SECTION}.${LOAD_WIDGET_MODULES_SETTING}`)) this.schedule();
      }),
      onConfigChanged(() => this.schedule()),
    ];
  }

  show(document: TextDocument, reveal = true): void {
    this.document = document;
    const title = formatText(this.text.panelTitle, fileName(document));
    if (this.panel === undefined) {
      this.panel = this.createPanel(title);
      // 新面板等 webview 发来 ready 后再投递, 脚本加载前投递的消息会丢失.
      return;
    }
    this.panel.title = title;
    if (reveal) this.panel.reveal(ViewColumn.Beside, true);
    void this.update();
  }

  private createPanel(title: string): WebviewPanel {
    const panel = window.createWebviewPanel(PREVIEW_VIEW_TYPE, title, { viewColumn: ViewColumn.Beside, preserveFocus: true }, { enableScripts: true });
    this.renderShell(panel, false, [], {});
    const { webview } = panel;
    webview.onDidReceiveMessage((message: unknown) => {
      if (isFromWebview(message)) void this.update();
    });
    panel.onDidDispose(() => {
      if (this.panel !== panel) return;
      this.cancel();
      this.panel = undefined;
      this.document = undefined;
    });
    return panel;
  }

  /** 设置 localResourceRoots 并写入 HTML 外壳(imports 是 schema 中本地模块地址的 import map 项); 重写外壳会重新加载 webview, 加载后它再发 ready. */
  private renderShell(panel: WebviewPanel, load: boolean, moduleRoots: readonly Uri[], imports: Readonly<Record<string, string>>): void {
    const scriptRoot = Uri.joinPath(this.extensionUri, SCRIPT_DIR);
    const { webview } = panel;
    webview.options = { enableScripts: true, localResourceRoots: [scriptRoot, ...moduleRoots] };
    const asUri = (file: string) => webview.asWebviewUri(Uri.joinPath(scriptRoot, file)).toString();
    webview.html = renderPreviewHtml({
      cspSource: webview.cspSource,
      nonce: createNonce(),
      scriptUri: asUri(SCRIPT_FILE),
      formStyleUri: asUri(FORM_STYLE_FILE),
      title: panel.title,
      text: this.text,
      lang: env.language,
      ...(load ? { sharedModules: { ...imports, ...Object.fromEntries(Object.entries(SHARED_MODULE_SHIMS).map(([specifier, file]) => [specifier, asUri(file)])) } } : {}),
    });
    this.shellKey = shellKey(load, moduleRoots, imports);
  }

  /**
   * 把语言服务给出的配置模块中的本地模块换成 webview 地址; 开启时收集需要放行的本地目录,
   * 并把 schema 中 file: 与盘符地址映射到 webview 地址(webview 原样 import() 这些地址, 由 import map 改写).
   */
  private resolveModules(
    panel: WebviewPanel,
    document: TextDocument,
    content: PreviewContent,
  ): { modules: PreviewModules; roots: Uri[]; imports: Record<string, string> } {
    const load = workspace.getConfiguration(CONFIGURATION_SECTION, document.uri).get<boolean>(LOAD_WIDGET_MODULES_SETTING, false) === true;
    const { webview } = panel;
    const isFile = document.uri.scheme === "file";
    const documentDir = isFile ? dirname(document.uri.fsPath) : undefined;
    const configDir = content.configFile === undefined ? undefined : dirname(content.configFile);
    const dirs = new Set<string>();
    const config: Record<string, WidgetModuleRef> = {};
    for (const [name, ref] of Object.entries(content.modules)) {
      const path = configDir === undefined ? undefined : localModulePath(ref.module, configDir);
      if (path === undefined) {
        config[name] = ref;
        continue;
      }
      config[name] = { ...ref, module: webview.asWebviewUri(Uri.file(path)).toString() };
      dirs.add(dirname(path));
    }
    if (!load) return { modules: { load, config, baseUrl: undefined }, roots: [], imports: {} };
    let imports: Record<string, string> = {};
    if (documentDir !== undefined) {
      const schema: unknown = content.schema === undefined ? undefined : JSON.parse(content.schema);
      const found = schemaModuleImports(schema, documentDir, (file) => webview.asWebviewUri(Uri.file(file)).toString());
      imports = found.imports;
      for (const dir of found.dirs) dirs.add(dir);
    }
    const folder = workspace.getWorkspaceFolder(document.uri);
    const roots = [...(folder === undefined ? [] : [folder.uri]), ...[...dirs].sort().map((dir) => Uri.file(dir))];
    const baseUrl = documentDir === undefined ? undefined : `${webview.asWebviewUri(Uri.file(documentDir)).toString().replace(/\/$/, "")}/`;
    return { modules: { load, config, baseUrl }, roots, imports };
  }

  private cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.sequence++;
  }

  private schedule(): void {
    if (this.panel === undefined) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.update();
    }, UPDATE_DELAY_MS);
  }

  private async update(): Promise<void> {
    const document = this.document;
    if (document === undefined || this.panel === undefined) return;
    if (document.isClosed) {
      this.post({ type: "unavailable", fileName: fileName(document), reason: this.text.documentClosed });
      return;
    }
    const sequence = ++this.sequence;
    let message: ToWebview;
    try {
      const content = await this.request(document.uri.toString());
      if (content === null) {
        message = { type: "unavailable", fileName: fileName(document), reason: this.text.notOpened };
      } else {
        const panel = this.panel;
        if (sequence !== this.sequence || document !== this.document || panel === undefined) return;
        const { modules, roots, imports } = this.resolveModules(panel, document, content);
        if (shellKey(modules.load, roots, imports) !== this.shellKey) {
          this.renderShell(panel, modules.load, roots, imports);
          return;
        }
        message = { type: "update", fileName: fileName(document), content, modules };
      }
    } catch (error) {
      this.log(error instanceof Error ? (error.stack ?? error.message) : String(error));
      message = { type: "unavailable", fileName: fileName(document), reason: this.text.serverUnavailable };
    }
    if (sequence === this.sequence && document === this.document) this.post(message);
  }

  private post(message: ToWebview): void {
    void this.panel?.webview.postMessage(message);
  }

  dispose(): void {
    this.cancel();
    this.panel?.dispose();
    for (const subscription of this.subscriptions) subscription.dispose();
  }
}

function shellKey(load: boolean, roots: readonly Uri[], imports: Readonly<Record<string, string>>): string {
  return JSON.stringify([load, roots.map((root) => root.toString()), Object.entries(imports).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))]);
}

function fileName(document: TextDocument): string {
  return workspace.asRelativePath(document.uri, false);
}

/** 命令参数是编辑器标题栏传入的资源 Uri; 从命令面板执行时取当前编辑器. */
export function registerPreview(extensionUri: Uri, request: RequestPreview, log: Log, onConfigChanged: OnConfigChanged): Disposable[] {
  const text = createPreviewText(l10n);
  const controller = new PreviewController(extensionUri, request, log, text, onConfigChanged);
  const command = commands.registerCommand(SHOW_PREVIEW_COMMAND, async (resource?: unknown) => {
    const document = resource instanceof Uri ? await workspace.openTextDocument(resource) : window.activeTextEditor?.document;
    if (document?.languageId !== LANGUAGE_ID) {
      void window.showInformationMessage(text.notJotl);
      return;
    }
    controller.show(document);
  });
  return [controller, command];
}
