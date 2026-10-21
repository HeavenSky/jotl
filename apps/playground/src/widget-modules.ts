// 扩展组件模块的登记: jotl.config.json 的 modules 登记到表单注册表, schema 根 x-ui.widgets 的模块地址供提示条与调试视图使用.
import {
  createDefaultRegistry,
  moduleWidgetRegistrations,
  schemaWidgetModules,
  type ReactRegistry,
  type WidgetModule,
} from '@jotl/form';
import type { JsonSchema } from '@jotl/core';

/** 相对模块地址(./ ../ /)的基准: 页面所在目录, 部署到子路径时同样指向 public/ 的产物. */
export function moduleBaseUrl(): string {
  return typeof document === 'undefined' ? 'http://localhost/' : document.baseURI;
}

/** 与 @jotl/form 的 moduleWidgetRegistrations 一致: 只有 ./ ../ / 开头的地址按基准解析. */
export function resolveModuleUrl(module: string, baseUrl: string): string {
  return /^(\.{1,2})?\//.test(module) ? new URL(module, baseUrl).href : module;
}

/** 默认注册表上登记给定的模块; 没有模块时返回 undefined, 表单使用共享的默认注册表. */
export function moduleRegistry(
  modules: Readonly<Record<string, WidgetModule>>,
  baseUrl: string,
  base?: ReactRegistry
): ReactRegistry | undefined {
  if (Object.keys(modules).length === 0) return base;
  const registry = base === undefined ? createDefaultRegistry() : base.extend();
  for (const registration of moduleWidgetRegistrations(modules, { baseUrl })) registry.register(registration);
  return registry;
}

/** schema 根 x-ui.widgets 中各模块解析后的地址, 去重. */
export function schemaModuleUrls(schema: JsonSchema, baseUrl: string): string[] {
  return [...new Set(Object.values(schemaWidgetModules(schema)).map(spec => resolveModuleUrl(spec.module, baseUrl)))];
}
