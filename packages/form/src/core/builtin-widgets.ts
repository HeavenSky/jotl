// 内置组件名表(契约 C2), format 到组件名的映射, 以及组件包共用的 schema 读取工具.
import { isSchemaObject, type JsonSchema, type JsonSchemaObject } from "@jotl/core";
import type { WidgetLevel } from "./contracts.js";

export type WidgetPriority = "P0" | "P1" | "P2";

export interface BuiltinWidget {
  level: WidgetLevel;
  priority: WidgetPriority;
}

/** 名字 → 层级与优先级; 组件包必须为每个名字提供实现. 名字是全局的, 各名字接受的数据形态见 acceptsShape. */
export const BUILTIN_WIDGETS = {
  form: { level: "view", priority: "P0" },
  field: { level: "decorator", priority: "P0" },
  page: { level: "layout", priority: "P0" },
  inline: { level: "layout", priority: "P0" },
  input: { level: "field", priority: "P0" },
  textarea: { level: "field", priority: "P0" },
  password: { level: "field", priority: "P0" },
  richtext: { level: "field", priority: "P1" },
  number: { level: "field", priority: "P0" },
  range: { level: "field", priority: "P0" },
  money: { level: "field", priority: "P0" },
  bigint: { level: "field", priority: "P0" },
  switch: { level: "field", priority: "P0" },
  checkbox: { level: "field", priority: "P0" },
  select: { level: "field", priority: "P0" },
  radio: { level: "field", priority: "P0" },
  output: { level: "field", priority: "P0" },
  date: { level: "field", priority: "P0" },
  time: { level: "field", priority: "P0" },
  datetime: { level: "field", priority: "P0" },
  url: { level: "field", priority: "P0" },
  email: { level: "field", priority: "P0" },
  color: { level: "field", priority: "P0" },
  image: { level: "field", priority: "P0" },
  file: { level: "field", priority: "P0" },
  json: { level: "field", priority: "P0" },
  list: { level: "composite", priority: "P0" },
  tuple: { level: "composite", priority: "P2" },
  kv: { level: "composite", priority: "P1" },
  union: { level: "composite", priority: "P1" },
  nullable: { level: "composite", priority: "P1" },
  tree: { level: "composite", priority: "P1" },
} as const satisfies Record<string, BuiltinWidget>;

export type BuiltinWidgetName = keyof typeof BUILTIN_WIDGETS;

export const FALLBACK_WIDGET = "json" satisfies BuiltinWidgetName;
export const ROOT_WIDGET = "form" satisfies BuiltinWidgetName;
export const DECORATOR_WIDGET = "field" satisfies BuiltinWidgetName;

/** format 到组件名的内置映射; format: uri 默认 url, image file 只由 x-ui.widget 选中. */
export const FORMAT_WIDGETS: Readonly<Record<string, BuiltinWidgetName>> = {
  uri: "url",
  email: "email",
  date: "date",
  time: "time",
  "date-time": "datetime",
  color: "color",
};

export function isBuiltinWidget(name: string): name is BuiltinWidgetName {
  return Object.hasOwn(BUILTIN_WIDGETS, name);
}

export interface EnumOption {
  value: unknown;
  /** 有 title 时取 title, 否则取值的 JSON 文本(字符串取原文). */
  label: string;
}

function labelOf(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** 读取枚举节点的选项: `oneOf: [{ const, title? }]`, `enum`, 或单个 `const`; 不是枚举时返回 undefined. */
export function enumOptions(schema: JsonSchema): EnumOption[] | undefined {
  if (!isSchemaObject(schema)) return undefined;
  if (Array.isArray(schema.enum)) return schema.enum.map((value) => ({ value, label: labelOf(value) }));
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const options: EnumOption[] = [];
    for (const branch of schema.oneOf) {
      if (!isSchemaObject(branch) || !("const" in branch)) return undefined;
      options.push({ value: branch.const, label: branch.title ?? labelOf(branch.const) });
    }
    return options;
  }
  return undefined;
}

/** 节点的 JSON 类型集合; 未声明 type 时返回空数组. */
export function schemaTypes(schema: JsonSchemaObject): string[] {
  if (schema.type === undefined) return [];
  return Array.isArray(schema.type) ? [...schema.type] : [schema.type];
}

/** 对象节点的必填属性集合. */
export function requiredKeys(schema: JsonSchemaObject): Set<string> {
  return new Set(Array.isArray(schema.required) ? schema.required : []);
}

/** 字段的显示标签: title, 否则键名. */
export function fieldLabel(schema: JsonSchema, key: string): string {
  return isSchemaObject(schema) && typeof schema.title === "string" ? schema.title : key;
}
