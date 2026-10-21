// 把诊断, 补全, 快速修复, 悬停, 跳转, 引用, 大纲与预览请求接到 LSP 连接上; 文档按增量同步保存在内存中, 各自并入所属 jotl.config.json 的登记.
import { JOTL_CONFIG_FILE, resolveLocale, setLocale } from "@jotl/core";
import {
  CodeActionKind,
  type Connection,
  type InitializeResult,
  type TextDocumentContentChangeEvent,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { getCodeActions } from "./code-actions.js";
import { getCompletions } from "./completion.js";
import { getDiagnostics, toLspDiagnostic } from "./document-diagnostics.js";
import { getHover } from "./hover.js";
import { getDefinition, getDocumentSymbols, getReferences } from "./navigation.js";
import { CONFIGURATION_SECTION, type LanguageServiceOptions, readInitializationOptions, readLocaleOption, withConfigWidgets } from "./options.js";
import { getPreview, PREVIEW_CONFIG_CHANGED_METHOD, PREVIEW_REQUEST_METHOD, type PreviewContent, type PreviewParams } from "./preview.js";
import { type ConfigHost, configDiagnostics, createConfigLookup } from "./project-config.js";
import { offsetAt } from "./text-position.js";

/** 文档变更后推送诊断前的防抖时长(毫秒). */
export const DIAGNOSTICS_DELAY = 200;

export interface ServerOptions {
  diagnosticsDelay?: number;
  /** 读取 jotl.config.json 的文件系统; 缺省为 Node 的同步读取. */
  configHost?: ConfigHost;
}

export const COMPLETION_TRIGGER_CHARACTERS: readonly string[] = [":", "[", ",", "'", "\"", "<", "|"];

function applyChange(text: string, change: TextDocumentContentChangeEvent): string {
  if (!("range" in change)) return change.text;
  const start = offsetAt(text, change.range.start);
  const end = offsetAt(text, change.range.end);
  return text.slice(0, start) + change.text + text.slice(end);
}

/** 注册全部处理函数; 调用方负责 `connection.listen()`. */
export function createServer(connection: Connection, serverOptions: ServerOptions = {}): void {
  const delay = serverOptions.diagnosticsDelay ?? DIAGNOSTICS_DELAY;
  const documents = new Map<string, string>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  let options: LanguageServiceOptions = {};
  const configs = createConfigLookup(serverOptions.configHost);
  const optionsFor = (uri: string) => {
    const config = configs.forDocument(uri);
    return withConfigWidgets(options, config?.widgets ?? {}, config?.widgetTypes);
  };

  const cancel = (uri: string) => {
    clearTimeout(pending.get(uri));
    pending.delete(uri);
  };

  const publish = (uri: string, text: string) => {
    cancel(uri);
    const config = configDiagnostics(configs.forDocument(uri)).map(toLspDiagnostic);
    void connection.sendDiagnostics({ uri, diagnostics: [...config, ...getDiagnostics(text, uri, optionsFor(uri))] });
  };

  const schedule = (uri: string) => {
    cancel(uri);
    pending.set(
      uri,
      setTimeout(() => {
        pending.delete(uri);
        const text = documents.get(uri);
        if (text !== undefined) publish(uri, text);
      }, delay),
    );
  };

  connection.onInitialize((params): InitializeResult => {
    options = readInitializationOptions(params.initializationOptions);
    setLocale(resolveLocale(readLocaleOption(params.initializationOptions) ?? params.locale));
    return {
      capabilities: {
        textDocumentSync: { openClose: true, change: TextDocumentSyncKind.Incremental },
        completionProvider: { triggerCharacters: [...COMPLETION_TRIGGER_CHARACTERS] },
        codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
      },
      serverInfo: { name: "jotl-language-server" },
    };
  });

  connection.onDidOpenTextDocument(({ textDocument }) => {
    documents.set(textDocument.uri, textDocument.text);
    publish(textDocument.uri, textDocument.text);
  });

  connection.onDidChangeTextDocument(({ textDocument, contentChanges }) => {
    const current = documents.get(textDocument.uri);
    if (current === undefined) return;
    const text = contentChanges.reduce(applyChange, current);
    documents.set(textDocument.uri, text);
    schedule(textDocument.uri);
  });

  /** 客户端按 `jotl` 节同步设置; 组件名或语言变更后重新诊断已打开的文档. */
  connection.onDidChangeConfiguration(({ settings }) => {
    const section = (settings as Record<string, unknown> | null | undefined)?.[CONFIGURATION_SECTION];
    if (section === undefined) return;
    options = readInitializationOptions(section);
    const locale = readLocaleOption(section);
    if (locale !== undefined) {
      setLocale(resolveLocale(locale));
      configs.clear();
    }
    for (const [uri, text] of documents) publish(uri, text);
  });

  /** 客户端监听各目录下的 jotl.config.json; 任一变更后重新查找并重新诊断, 清掉缓存之后才通知预览刷新, 预览自己监听文件会读到旧配置. */
  connection.onDidChangeWatchedFiles(({ changes }) => {
    if (!changes.some((change) => change.uri.endsWith(`/${JOTL_CONFIG_FILE}`))) return;
    configs.clear();
    for (const [uri, text] of documents) publish(uri, text);
    void connection.sendNotification(PREVIEW_CONFIG_CHANGED_METHOD);
  });

  connection.onDidCloseTextDocument(({ textDocument }) => {
    cancel(textDocument.uri);
    documents.delete(textDocument.uri);
    void connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
  });

  connection.onCompletion(({ textDocument, position }) => {
    const text = documents.get(textDocument.uri);
    return text === undefined ? [] : getCompletions(text, position, optionsFor(textDocument.uri));
  });

  connection.onCodeAction(({ textDocument, range }) => {
    const text = documents.get(textDocument.uri);
    return text === undefined ? [] : getCodeActions(text, textDocument.uri, range, optionsFor(textDocument.uri));
  });

  connection.onHover(({ textDocument, position }) => {
    const text = documents.get(textDocument.uri);
    return text === undefined ? null : getHover(text, textDocument.uri, position, optionsFor(textDocument.uri));
  });

  connection.onDefinition(({ textDocument, position }) => {
    const text = documents.get(textDocument.uri);
    return text === undefined ? [] : getDefinition(text, textDocument.uri, position);
  });

  connection.onReferences(({ textDocument, position, context }) => {
    const text = documents.get(textDocument.uri);
    return text === undefined ? [] : getReferences(text, textDocument.uri, position, context.includeDeclaration);
  });

  connection.onDocumentSymbol(({ textDocument }) => {
    const text = documents.get(textDocument.uri);
    return text === undefined ? [] : getDocumentSymbols(text, textDocument.uri);
  });

  /** 文档未打开时返回 null. */
  connection.onRequest(PREVIEW_REQUEST_METHOD, ({ textDocument }: PreviewParams): PreviewContent | null => {
    const text = documents.get(textDocument.uri);
    return text === undefined ? null : getPreview(text, textDocument.uri, optionsFor(textDocument.uri), configs.forDocument(textDocument.uri));
  });
}

/** 按进程参数(`--node-ipc` `--stdio` `--socket`)选择传输方式并开始监听. */
export function startServer(): Connection {
  const connection = createConnection(ProposedFeatures.all);
  createServer(connection);
  connection.listen();
  return connection;
}
