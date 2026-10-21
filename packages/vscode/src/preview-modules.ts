// 预览中的扩展组件模块: 读取模块声明(jotl.config.json 的 widgets 与 schema 根 x-ui.widgets), 插件与 webview 之间传递的模块信息, 以及 webview 中 React 共享垫片的约定; 不接触 vscode API 与 Node 模块.

export interface WidgetModuleRef {
  module: string;
  export?: string;
}

/** 插件随预览内容发给 webview 的模块信息. */
export interface PreviewModules {
  /** 设置 `jotl.preview.loadWidgetModules`. */
  load: boolean;
  /** jotl.config.json 中的模块声明; 本地路径已换成 webview 可加载的地址. */
  config: Record<string, WidgetModuleRef>;
  /** schema 根 x-ui.widgets 中相对地址的基准(文档所在目录的 webview 地址, 以 / 结尾); 无法确定时为 undefined. */
  baseUrl: string | undefined;
}

/** 必须等于 package.json 中 `contributes.configuration` 的设置名. */
export const LOAD_WIDGET_MODULES_SETTING = 'preview.loadWidgetModules';

/**
 * webview 中由预览脚本挂到 globalThis 上的模块表(说明符 → 模块对象), 垫片模块从这里取出同一份 React 再导出;
 * 必须等于 build.mjs 中生成垫片时读取的全局名.
 */
export const SHARED_MODULES_GLOBAL = '__jotlPreviewModules';

/** import map 说明符 → dist 下的垫片文件名; 必须等于 build.mjs 中 SHIMS 的说明符与文件名. */
export const SHARED_MODULE_SHIMS: Readonly<Record<string, string>> = {
  react: 'preview-shim-react.js',
  'react/jsx-runtime': 'preview-shim-react-jsx-runtime.js',
  'react-dom': 'preview-shim-react-dom.js',
  'react-dom/client': 'preview-shim-react-dom-client.js',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 名字 → 声明的对象中带非空 module 的项; 字符串与不带 module 的 schema 对象只声明底层类型, 跳过. */
export function widgetModuleRefs(widgets: unknown): Record<string, WidgetModuleRef> {
  const out: Record<string, WidgetModuleRef> = {};
  if (!isRecord(widgets)) return out;
  for (const [name, value] of Object.entries(widgets)) {
    if (!isRecord(value)) continue;
    const { module, export: exportName } = value;
    if (typeof module !== 'string' || module === '') continue;
    out[name] = typeof exportName === 'string' && exportName !== '' ? { module, export: exportName } : { module };
  }
  return out;
}

/** schema 根 x-ui.widgets 中的模块声明. */
export function schemaModuleRefs(schema: unknown): Record<string, WidgetModuleRef> {
  if (!isRecord(schema)) return {};
  const xUi = schema['x-ui'];
  return isRecord(xUi) ? widgetModuleRefs(xUi.widgets) : {};
}

/** 以 ./ ../ / 开头的地址按所在文件的目录解析; 其余(https 等)原样交给 import(). */
export function isRelativeModule(module: string): boolean {
  return /^(\.{1,2})?\//.test(module);
}

/** Windows 盘符绝对路径(`C:\` 或 `C:/` 开头); 交给 import() 时会被当作 `c:` scheme 的 URL. */
export function isDrivePath(module: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(module);
}

export function isPreviewModules(value: unknown): value is PreviewModules {
  if (!isRecord(value) || typeof value.load !== 'boolean' || !isRecord(value.config)) return false;
  if (value.baseUrl !== undefined && typeof value.baseUrl !== 'string') return false;
  return Object.values(value.config).every(
    ref =>
      isRecord(ref) && typeof ref.module === 'string' && (ref.export === undefined || typeof ref.export === 'string')
  );
}
