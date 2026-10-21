// x-ui 关键字(CT4)的类型.
import type { JsonPointer } from './json-pointer.js';
import type { JsonSchemaObject } from './json-schema.js';

/** 对象节点的布局(D42); tabs 时每个 groups 项一个标签页, 未分组字段放第一个标签页. */
export type XUiLayout = 'stack' | 'tabs' | 'grid';

export interface XUiGroup {
  title: string;
  fields: string[];
}

/** 叶子条件的基准: 缺省为数据根; "node" 为当前节点所在的对象. */
export type ConditionBase = 'node';

/**
 * 显示条件(D43). field 为从基准起算的指针, 其中的 "*" 取当前节点所在数组的对应下标;
 * eq ne in notIn 按 JSON 值深度相等比较, gt gte lt lte 只比较数值.
 */
export type Condition =
  | { field: JsonPointer; base?: ConditionBase; eq: unknown }
  | { field: JsonPointer; base?: ConditionBase; ne: unknown }
  | { field: JsonPointer; base?: ConditionBase; in: unknown[] }
  | { field: JsonPointer; base?: ConditionBase; notIn: unknown[] }
  | { field: JsonPointer; base?: ConditionBase; truthy: boolean }
  | { field: JsonPointer; base?: ConditionBase; gt: number }
  | { field: JsonPointer; base?: ConditionBase; gte: number }
  | { field: JsonPointer; base?: ConditionBase; lt: number }
  | { field: JsonPointer; base?: ConditionBase; lte: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type XUiVariant = Omit<XUi, 'variants' | 'rules' | 'version' | 'widgets'>;

/** 扩展组件模块: ES 模块地址与导出名, 导出名缺省为 `default`. */
export interface XUiWidgetModule {
  /** 底层类型: 类型名或 schema 对象; 缺省为 object. */
  base?: string | JsonSchemaObject;
  module: string;
  export?: string;
}

export interface XUi {
  /** widget 名, 内置名见 `@jotl/form/core` 的 BUILTIN_WIDGETS. */
  widget?: string;
  /** 透传给组件的参数, 必须可 JSON 序列化. */
  props?: Record<string, unknown>;
  /** 字段外壳 widget 名; false 表示不要外壳. */
  decorator?: string | false;
  /** 对象节点: 子字段顺序, 未列出的按原顺序排在后面. */
  order?: string[];
  /** 对象节点: 分组, 未分组的字段排在最前. */
  groups?: XUiGroup[];
  layout?: XUiLayout;
  /** layout 为 grid 时的列数, 默认 2. */
  columns?: number;
  hidden?: boolean;
  visibleIf?: Condition;
  /** 对象, 对象元素的数组与 map: 入口行与面包屑显示的字段名. */
  summary?: string;
  /** 数值类: 失焦与只读时按千分位显示. */
  thousands?: boolean;
  /** 场景覆盖(D44), 场景名默认 "default". */
  variants?: Record<string, XUiVariant>;
  /** 只在根节点生效. */
  rules?: UiRule[];
  /** 只在根节点出现. */
  version?: 1;
  /** 只在根节点出现: widget 名 → 实现它的组件模块. */
  widgets?: Record<string, XUiWidgetModule>;
}

export interface UiRuleMatch {
  /** 匹配 schema 文档内的指针, 支持 "*" 匹配单个片段. */
  pointer?: string;
  type?: string;
  format?: string;
  /** true 匹配枚举节点. */
  enum?: boolean;
  /** 匹配该节点当前已选中的 widget 名. */
  widget?: string;
}

export interface UiRule {
  match: UiRuleMatch;
  ui: XUiVariant;
}

export const DEFAULT_SCENE = 'default';
export const DEFAULT_GRID_COLUMNS = 2;
