// 示例源码: Playground 自带的综合示例与扩展组件模块示例在前, 其后是构建时打包进产物的仓库 fixtures 的 source.jotl; 运行时不读文件系统.
import showcase from "./examples/showcase.jotl?raw";
import widgetModule from "./examples/widget-module.jotl?raw";

export interface Example {
  /** 自带示例的固定名, 或 fixtures 下的目录名. */
  id: string;
  source: string;
}

/** 覆盖 v1 主要写法的综合示例, 也是默认示例. */
export const SHOWCASE_EXAMPLE_ID = "v1-showcase";

/** 在根元数据中声明扩展组件模块的示例, 预览加载 public/widgets/rating.js. */
export const WIDGET_MODULE_EXAMPLE_ID = "widget-module";

const modules = import.meta.glob<string>("../../../fixtures/*/source.jotl", { query: "?raw", import: "default", eager: true });

function exampleId(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 2] ?? path;
}

export const FIXTURE_EXAMPLES: readonly Example[] = Object.entries(modules)
  .map(([path, source]) => ({ id: exampleId(path), source }))
  .sort((a, b) => a.id.localeCompare(b.id));

export const EXAMPLES: readonly Example[] = [
  { id: SHOWCASE_EXAMPLE_ID, source: showcase },
  { id: WIDGET_MODULE_EXAMPLE_ID, source: widgetModule },
  ...FIXTURE_EXAMPLES,
];

/** 本地存储中没有源码时加载的示例. */
export const DEFAULT_EXAMPLE_ID = SHOWCASE_EXAMPLE_ID;

export function findExample(id: string): Example | undefined {
  return EXAMPLES.find((example) => example.id === id);
}

export function defaultSource(): string {
  return (findExample(DEFAULT_EXAMPLE_ID) ?? EXAMPLES[0])?.source ?? "";
}
