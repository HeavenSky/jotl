// 预览的消息约定: 插件向语言服务请求预览内容的方法名, 以及插件与预览 webview 之间的消息与校验.
import type { PreviewContent } from '@jotl/language-server';
import { isPreviewModules, type PreviewModules } from './preview-modules.js';

/** 必须等于 `@jotl/language-server` 的 `PREVIEW_REQUEST_METHOD`; 插件入口不导入 `@jotl/language-server` 的值, 否则语言服务的实现会被打进扩展入口. */
export const PREVIEW_REQUEST_METHOD = 'jotl/preview';
/** 必须等于 `@jotl/language-server` 的 `PREVIEW_CONFIG_CHANGED_METHOD`; 不一致时改了 jotl.config.json 预览不再刷新. */
export const PREVIEW_CONFIG_CHANGED_METHOD = 'jotl/configChanged';

export type ToWebview =
  | { type: 'update'; fileName: string; content: PreviewContent; modules?: PreviewModules }
  | { type: 'unavailable'; fileName: string; reason: string };

export type FromWebview = { type: 'ready' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** webview 只信任结构完整的消息; 字段内容按纯文本渲染. */
export function isToWebview(value: unknown): value is ToWebview {
  if (!isRecord(value) || typeof value.fileName !== 'string') return false;
  if (value.type === 'unavailable') return typeof value.reason === 'string';
  if (value.type !== 'update' || !isRecord(value.content)) return false;
  if (value.modules !== undefined && !isPreviewModules(value.modules)) return false;
  const { schema, diagnostics, typescript, typescriptDiagnostics } = value.content;
  const optionalString = (v: unknown) => v === undefined || typeof v === 'string';
  return (
    optionalString(schema) &&
    optionalString(typescript) &&
    Array.isArray(diagnostics) &&
    Array.isArray(typescriptDiagnostics)
  );
}

export function isFromWebview(value: unknown): value is FromWebview {
  return isRecord(value) && value.type === 'ready';
}
