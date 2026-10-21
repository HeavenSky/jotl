// Jotl 的 VS Code 插件入口: 以 IPC 启动语言服务进程并连接到 jotl 语言的文档(同步 jotl 设置节与 jotl.config.json 的变更), 注册预览命令.
import type { LanguageServiceOptions, PreviewContent, PreviewParams } from '@jotl/language-server';
import { type ExtensionContext, workspace } from 'vscode';
import {
  LanguageClient,
  type LanguageClientOptions,
  RequestType,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { registerPreview } from './preview-panel.js';
import { PREVIEW_CONFIG_CHANGED_METHOD, PREVIEW_REQUEST_METHOD } from './preview-protocol.js';

/** 必须等于打包脚本中语言服务入口的输出路径. */
const SERVER_MODULE = 'dist/server.cjs';
const CONFIGURATION_SECTION = 'jotl';
const PROJECT_CONFIG_GLOB = '**/jotl.config.json';

const PREVIEW_REQUEST = new RequestType<PreviewParams, PreviewContent | null, void>(PREVIEW_REQUEST_METHOD);

let client: LanguageClient | undefined;

function initializationOptions(): LanguageServiceOptions {
  const widgets = workspace.getConfiguration(CONFIGURATION_SECTION).get<unknown>('registeredWidgets');
  return Array.isArray(widgets) ? { registeredWidgets: widgets.filter((w): w is string => typeof w === 'string') } : {};
}

export async function activate(context: ExtensionContext): Promise<void> {
  const module = context.asAbsolutePath(SERVER_MODULE);
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: { module, transport: TransportKind.ipc, options: { execArgv: ['--nolazy', '--inspect=6009'] } },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'jotl' }],
    initializationOptions: initializationOptions(),
    synchronize: {
      configurationSection: CONFIGURATION_SECTION,
      fileEvents: workspace.createFileSystemWatcher(PROJECT_CONFIG_GLOB),
    },
  };
  const running = new LanguageClient('jotl', 'Jotl', serverOptions, clientOptions);
  client = running;
  context.subscriptions.push(
    ...registerPreview(
      context.extensionUri,
      uri => running.sendRequest(PREVIEW_REQUEST, { textDocument: { uri } }),
      message => running.outputChannel.appendLine(message),
      listener => running.onNotification(PREVIEW_CONFIG_CHANGED_METHOD, listener)
    )
  );
  await running.start();
}

export async function deactivate(): Promise<void> {
  const running = client;
  client = undefined;
  await running?.stop();
}
