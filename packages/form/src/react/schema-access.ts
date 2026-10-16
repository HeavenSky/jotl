// schema 读取: 按数据片段求子节点位置, 区分字段字面量, 交给组件的 schema 与数据类型判定; 有效 schema 由 core/ 解析.
import {
  appendPointer,
  isSchemaObject,
  lookupPointer,
  tryParsePointer,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type JsonSchemaType,
} from "@jotl/core";
import { resolveSchema, resolveSchemaAt, schemaTypes } from "../core/index.js";

/** 节点的有效 schema 与每个关键字来自哪个 schema 位置; 拆分出的虚拟节点沿用被拆分节点的来源. */
export interface SchemaInfo {
  effective: JsonSchemaObject;
  origin: ReadonlyMap<string, JsonPointer>;
}

const EMPTY_INFO: SchemaInfo = { effective: {}, origin: new Map() };

export type ContainerKind = "array" | "object" | "none";

function isArrayLike(schema: JsonSchemaObject): boolean {
  const types = schemaTypes(schema);
  if (types.length > 0) return types.includes("array");
  return schema.items !== undefined || schema.prefixItems !== undefined;
}

function isObjectLike(schema: JsonSchemaObject): boolean {
  const types = schemaTypes(schema);
  if (types.length > 0) return types.includes("object");
  return schema.properties !== undefined || schema.additionalProperties !== undefined;
}

export function containerKind(schema: JsonSchemaObject): ContainerKind {
  if (isArrayLike(schema)) return "array";
  if (isObjectLike(schema)) return "object";
  return "none";
}

/** 子数据片段对应的 schema 位置与模板片段("*" 表示数组元素或字典值); 无法确定时为 undefined. */
export interface ChildSite {
  templateToken: string;
  pointer: JsonPointer | undefined;
  info: SchemaInfo;
}

function originOf(info: SchemaInfo, keyword: string, fallback: JsonPointer): JsonPointer {
  return info.origin.get(keyword) ?? fallback;
}

export function childSite(document: JsonSchema, info: SchemaInfo, ownPointer: JsonPointer, token: string): ChildSite | undefined {
  const schema = info.effective;
  if (isArrayLike(schema)) {
    if (!/^(0|[1-9]\d*)$/.test(token)) return undefined;
    const index = Number(token);
    if (Array.isArray(schema.prefixItems) && index < schema.prefixItems.length) {
      const pointer = appendPointer(originOf(info, "prefixItems", ownPointer), "prefixItems", index);
      return { templateToken: token, pointer, info: resolveSchemaAt(document, pointer) };
    }
    if (schema.items === undefined) return { templateToken: "*", pointer: undefined, info: EMPTY_INFO };
    const pointer = appendPointer(originOf(info, "items", ownPointer), "items");
    return { templateToken: "*", pointer, info: resolveSchemaAt(document, pointer) };
  }
  if (isSchemaObject(schema.properties) && Object.hasOwn(schema.properties, token)) {
    const pointer = appendPointer(originOf(info, "properties", ownPointer), "properties", token);
    return { templateToken: token, pointer, info: resolveSchemaAt(document, pointer) };
  }
  const extra = schema.additionalProperties;
  if (extra === true || isSchemaObject(extra)) {
    const pointer = appendPointer(originOf(info, "additionalProperties", ownPointer), "additionalProperties");
    return { templateToken: "*", pointer, info: resolveSchemaAt(document, pointer) };
  }
  return undefined;
}

/** 引用处 schema 的被引用类型名(引用目标指针的最后一段). */
export function refName(document: JsonSchema, pointer: JsonPointer): string | undefined {
  const { found, value } = lookupPointer(document, pointer);
  if (!found || !isSchemaObject(value) || typeof value.$ref !== "string") return undefined;
  const tokens = tryParsePointer(value.$ref.startsWith("#") ? safeDecode(value.$ref.slice(1)) : "");
  return tokens?.[tokens.length - 1];
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** 对象分支中区分字段的字面量(const 或单值 enum). */
export function literalOf(document: JsonSchema, info: SchemaInfo, name: string): { value: unknown } | undefined {
  const properties = info.effective.properties;
  if (!isSchemaObject(properties) || !Object.hasOwn(properties, name)) return undefined;
  const property = resolveSchema(document, properties[name] as JsonSchema).effective;
  if ("const" in property) return { value: property.const };
  if (Array.isArray(property.enum) && property.enum.length === 1) return { value: property.enum[0] };
  return undefined;
}

export function jsonTypeOf(value: unknown): JsonSchemaType | undefined {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "number":
      return Number.isInteger(value) ? "integer" : "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return undefined;
  }
}

/** 值的 JSON 类型是否在 schema 声明的 type 中; 未声明 type 时视为相符, 整数同时算作 number. */
export function acceptsType(schema: JsonSchemaObject, value: unknown): boolean {
  const types = schemaTypes(schema);
  if (types.length === 0) return true;
  const actual = jsonTypeOf(value);
  if (actual === undefined) return false;
  if (actual === "integer") return types.includes("integer") || types.includes("number");
  return types.includes(actual);
}

const widgetSchemaCache = new WeakMap<JsonSchemaObject, JsonSchemaObject>();

/** 交给组件的 schema: items 为引用时换成被引用的有效 schema, 让枚举数组的组件能读到选项; 组件拿不到文档, 无法自行解析. */
export function widgetSchema(document: JsonSchema, info: SchemaInfo): JsonSchemaObject {
  const schema = info.effective;
  if (!isSchemaObject(schema.items) || typeof schema.items.$ref !== "string") return schema;
  const cached = widgetSchemaCache.get(schema);
  if (cached !== undefined) return cached;
  const resolved: JsonSchemaObject = { ...schema, items: resolveSchema(document, schema.items).effective };
  widgetSchemaCache.set(schema, resolved);
  return resolved;
}
