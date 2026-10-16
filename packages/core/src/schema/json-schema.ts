// JSON Schema 2020-12 文档的类型, 规范化的关键字顺序与子 schema 遍历.
import type { XUi } from "./x-ui.js";

export const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

export type JsonSchemaType = "string" | "number" | "integer" | "boolean" | "null" | "array" | "object";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonSchema = boolean | JsonSchemaObject;

/** 2020-12 的全部关键字, Jotl 扩展关键字, 以及透传的未知关键字. */
export interface JsonSchemaObject {
  $schema?: string;
  $id?: string;
  $ref?: string;
  $dynamicRef?: string;
  $anchor?: string;
  $dynamicAnchor?: string;
  $vocabulary?: Record<string, boolean>;
  $comment?: string;
  $defs?: Record<string, JsonSchema>;

  title?: string;
  description?: string;
  default?: unknown;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  examples?: unknown[];

  type?: JsonSchemaType | JsonSchemaType[];
  const?: unknown;
  enum?: unknown[];

  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;

  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  contentMediaType?: string;
  contentEncoding?: string;
  contentSchema?: JsonSchema;

  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  prefixItems?: JsonSchema[];
  items?: JsonSchema;
  contains?: JsonSchema;
  minContains?: number;
  maxContains?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  unevaluatedItems?: JsonSchema;

  properties?: Record<string, JsonSchema>;
  patternProperties?: Record<string, JsonSchema>;
  additionalProperties?: JsonSchema;
  propertyNames?: JsonSchema;
  required?: string[];
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, JsonSchema>;
  minProperties?: number;
  maxProperties?: number;
  unevaluatedProperties?: JsonSchema;

  "x-ui"?: XUi;
  "x-deprecatedReason"?: string;
  /** 自定义错误文案(D41): 字符串替换该节点全部错误的消息, 对象按关键字名替换. */
  errorMessage?: string | Record<string, string>;

  [keyword: string]: unknown;
}

export function isSchemaObject(schema: unknown): schema is JsonSchemaObject {
  return typeof schema === "object" && schema !== null && !Array.isArray(schema);
}

const HEAD_ORDER = [
  "$schema", "$id", "$ref", "$comment", "title", "description", "type", "const", "enum", "oneOf", "anyOf",
  "format", "contentMediaType",
];
const CONSTRAINT_ORDER = [
  "minLength", "maxLength", "pattern", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minItems", "maxItems", "minProperties", "maxProperties",
];
const STRUCTURE_ORDER = ["properties", "required", "additionalProperties", "prefixItems", "items", "uniqueItems"];
const ANNOTATION_ORDER = ["default", "examples", "deprecated", "readOnly", "writeOnly"];
const TAIL_ORDER = ["x-ui", "x-deprecatedReason", "$defs"];
const LISTED = new Set([...HEAD_ORDER, ...CONSTRAINT_ORDER, ...STRUCTURE_ORDER, ...ANNOTATION_ORDER, ...TAIL_ORDER]);

/** 子 schema 所在的关键字: 值为单个 schema, schema 数组, 或以名字为键的 schema 表. */
export const SUBSCHEMA_KEYWORDS = {
  single: [
    "additionalProperties", "items", "contains", "propertyNames", "not", "if", "then", "else",
    "unevaluatedItems", "unevaluatedProperties", "contentSchema",
  ],
  array: ["prefixItems", "allOf", "anyOf", "oneOf"],
  map: ["properties", "patternProperties", "$defs", "dependentSchemas"],
} as const;

/** 按规范化规则 7 排列关键字, 递归处理全部子 schema; 不改变语义. */
export function orderKeywords(schema: JsonSchema): JsonSchema {
  if (!isSchemaObject(schema)) return schema;
  const keys = Object.keys(schema);
  const unlisted = keys.filter((k) => !LISTED.has(k)).sort();
  const order = [
    ...HEAD_ORDER, ...CONSTRAINT_ORDER, ...STRUCTURE_ORDER, ...ANNOTATION_ORDER, ...unlisted, ...TAIL_ORDER,
  ].filter((k) => Object.hasOwn(schema, k));
  // 赋值写法遇到 `__proto__` 键会改写原型而丢键, 必须用 defineProperty.
  const out: JsonSchemaObject = {};
  for (const key of order) {
    Object.defineProperty(out, key, { value: orderSubschemas(key, schema[key]), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

function orderSubschemas(key: string, value: unknown): unknown {
  if ((SUBSCHEMA_KEYWORDS.single as readonly string[]).includes(key)) return orderKeywords(value as JsonSchema);
  if ((SUBSCHEMA_KEYWORDS.array as readonly string[]).includes(key) && Array.isArray(value)) {
    return value.map((s) => orderKeywords(s as JsonSchema));
  }
  if ((SUBSCHEMA_KEYWORDS.map as readonly string[]).includes(key) && isSchemaObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, s]) => [k, orderKeywords(s as JsonSchema)]));
  }
  return value;
}
