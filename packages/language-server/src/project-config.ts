// 文档所属的 jotl.config.json: 从文档所在目录向上找最近的一个(到 git 顶层或文件系统根为止); 结果按目录缓存, 配置文件变更后清空.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic as JotlDiagnostic, JsonSchemaObject, XUiWidgetModule } from "@jotl/core";
import { JOTL_CONFIG_FILE, l10n, readJotlConfig } from "@jotl/core";
import { lspDiagnostic } from "./diagnostics.js";

export interface ConfigHost {
  exists(path: string): boolean;
  /** 读取 UTF-8 文本; 失败时抛错. */
  readFile(path: string): string;
}

export interface ProjectConfig {
  file: string;
  widgets: Record<string, JsonSchemaObject>;
  /** 写成模块声明的项; `module` 原样保留, 相对路径按 `file` 所在目录解析. */
  modules: Record<string, XUiWidgetModule>;
  /** 写了底层类型的非大驼峰名 → 底层 schema, 只用于 widget 与字段类型的兼容检查. */
  widgetTypes: Record<string, JsonSchemaObject>;
  /** 读取失败, JSON 不合法或内容不合法的说明; 不合法的项已跳过. */
  problems: string[];
}

const NODE_HOST: ConfigHost = { exists: existsSync, readFile: (path) => readFileSync(path, "utf8") };

function findConfigFile(host: ConfigHost, start: string): string | undefined {
  let dir = start;
  for (;;) {
    const candidate = join(dir, JOTL_CONFIG_FILE);
    if (host.exists(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir || host.exists(join(dir, ".git"))) return undefined;
    dir = parent;
  }
}

function readConfig(host: ConfigHost, file: string): ProjectConfig {
  let value: unknown;
  try {
    value = JSON.parse(host.readFile(file).replace(/^\uFEFF/, ""));
  } catch (error) {
    return { file, widgets: {}, modules: {}, widgetTypes: {}, problems: [error instanceof SyntaxError ? l10n("不是合法的 JSON", "not valid JSON") : String(error instanceof Error ? error.message : error)] };
  }
  const { config, issues } = readJotlConfig(value);
  return { file, widgets: config.widgets, modules: config.modules, widgetTypes: config.widgetTypes ?? {}, problems: issues.map((i) => (i.pointer === "" ? i.message : `${i.pointer}: ${i.message}`)) };
}

export interface ConfigLookup {
  /** 非 `file:` 文档或找不到配置文件时返回 undefined. */
  forDocument(uri: string): ProjectConfig | undefined;
  clear(): void;
}

export function createConfigLookup(host: ConfigHost = NODE_HOST): ConfigLookup {
  const byDir = new Map<string, ProjectConfig | undefined>();
  return {
    forDocument(uri) {
      if (!uri.startsWith("file:")) return undefined;
      const dir = dirname(fileURLToPath(uri));
      if (!byDir.has(dir)) {
        const file = findConfigFile(host, dir);
        byDir.set(dir, file === undefined ? undefined : readConfig(host, file));
      }
      return byDir.get(dir);
    },
    clear: () => byDir.clear(),
  };
}

/** 配置文件的问题报在文档开头. */
export function configDiagnostics(config: ProjectConfig | undefined): JotlDiagnostic[] {
  return (config?.problems ?? []).map((reason) => lspDiagnostic("JOTL7002", { file: config!.file, reason }));
}
