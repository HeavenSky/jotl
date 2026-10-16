// 扩展组件模块: 按模块地址生成懒加载的组件登记项, 以及从 schema 根 x-ui.widgets 读取模块声明.
import { isSchemaObject, l10n, type JsonSchema, type Locale } from "@jotl/core";
import type { WidgetLevel, WidgetRegistration } from "../core/index.js";
import type { ReactWidgetComponent } from "./types.js";

/** 一个扩展组件模块: 模块地址与导出名(缺省 "default"); level 缺省 "field", 组件接管整个值. */
export interface WidgetModule {
  module: string;
  export?: string;
  level?: WidgetLevel;
}

export interface ModuleWidgetOptions {
  /** 加载模块, 缺省为动态 import(); 浏览器中模块的 react 须与宿主共用(如 import map). */
  importer?: (url: string) => Promise<unknown>;
  /** 相对地址(./ ../ /)的基准; 不给时原样交给 importer. */
  baseUrl?: string;
  /** 加载失败文案的语言; 缺省取全局当前语言. */
  locale?: Locale;
}

const defaultImporter = (url: string): Promise<unknown> => import(/* @vite-ignore */ url);

function resolveUrl(module: string, baseUrl: string | undefined): string {
  if (baseUrl === undefined || !/^(\.{1,2})?\//.test(module)) return module;
  return new URL(module, baseUrl).href;
}

function isComponent(value: unknown): value is ReactWidgetComponent {
  // memo 与 forwardRef 的结果是带 $$typeof 的对象.
  return typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value);
}

/** 按 { 组件名: { module, export? } } 生成带 load 的登记项; 加载失败或导出不是组件时按 F9 显示失败与重试. */
export function moduleWidgetRegistrations(
  modules: Readonly<Record<string, WidgetModule>>,
  options: ModuleWidgetOptions = {},
): WidgetRegistration<ReactWidgetComponent>[] {
  const importer = options.importer ?? defaultImporter;
  return Object.entries(modules).map(([name, spec]) => {
    const url = resolveUrl(spec.module, options.baseUrl);
    const exportName = spec.export ?? "default";
    return {
      name,
      level: spec.level ?? "field",
      // 有 load 时 component 是加载前的占位; undefined 时渲染器显示内置的加载中提示.
      component: undefined as unknown as ReactWidgetComponent,
      load: async () => {
        const loaded = await importer(url);
        const component = typeof loaded === "object" && loaded !== null ? (loaded as Record<string, unknown>)[exportName] : undefined;
        if (!isComponent(component)) throw new Error(l10n(`扩展组件 ${name}: 模块 ${url} 的导出 ${exportName} 不是 React 组件`, `Widget ${name}: export ${exportName} of module ${url} is not a React component`, options.locale));
        return component;
      },
    };
  });
}

/** schema 根 x-ui.widgets 中带 module 的声明; 没有或不合法的项跳过. */
export function schemaWidgetModules(schema: JsonSchema): Record<string, WidgetModule> {
  const out: Record<string, WidgetModule> = {};
  if (!isSchemaObject(schema)) return out;
  const xUi = (schema as Record<string, unknown>)["x-ui"];
  const widgets = typeof xUi === "object" && xUi !== null ? (xUi as Record<string, unknown>).widgets : undefined;
  if (typeof widgets !== "object" || widgets === null) return out;
  for (const [name, value] of Object.entries(widgets)) {
    if (typeof value !== "object" || value === null) continue;
    const { module, export: exportName } = value as Record<string, unknown>;
    if (typeof module !== "string" || module === "") continue;
    out[name] = typeof exportName === "string" ? { module, export: exportName } : { module };
  }
  return out;
}
