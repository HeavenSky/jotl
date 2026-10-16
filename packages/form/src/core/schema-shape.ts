// 数据形态识别与内置匹配规则: 由有效 schema 判定形态, 得出内置组件名, 子节点位置与可区分联合的区分字段.
import {
  appendPointer,
  isSchemaObject,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type JsonSchemaType,
  isTimestampValueFormat,
  valueFormatComponent,
} from "@jotl/core";
import { FALLBACK_WIDGET, FORMAT_WIDGETS, enumOptions, isBuiltinWidget, requiredKeys, schemaTypes, type BuiltinWidgetName } from "./builtin-widgets.js";
import { jsonEqual } from "./condition.js";
import { resolveNode, type ResolvedNode, type SchemaSite } from "./schema-node.js";

/** 影响数据形态而渲染器不支持的关键字(F7); 只影响校验的关键字不在此列. */
export const UNSUPPORTED_KEYWORDS = ["not", "if", "allOf", "$dynamicRef", "dependentSchemas", "patternProperties"] as const;

export const RICH_TEXT_MEDIA_TYPE = "text/html";
export const JSON_TEXT_MEDIA_TYPE = "application/json";

export type ScalarType = "string" | "number" | "integer" | "boolean";
export type DecimalKind = "money" | "bigint";

/** 子节点位置; dataToken 为相对父节点的数据片段, 未定义表示与父节点数据路径相同. */
export interface ChildSite {
  site: SchemaSite;
  dataToken?: string;
}

export type Shape =
  | { kind: "unsupported"; feature: string }
  | { kind: "unresolved"; ref: string }
  | { kind: "json" | "const" | "object" | "map" | "array" | "enumArray" | "tuple" | "nullable" | DecimalKind }
  | { kind: "enum"; count: number }
  | { kind: "union"; discriminator?: string }
  | { kind: "scalar"; type: ScalarType; widget: BuiltinWidgetName };

const WILDCARD_TOKEN = "*";

/**
 * 日期组件的存储格式 `x-valueFormat`: 只认没有标准 format 的字符串节点, 以及格式为时间戳 `x` `X` 的整数节点;
 * 有标准 format 的节点按 format 判定.
 */
export function valueFormatOf(schema: JsonSchemaObject, type: string | undefined): string | undefined {
  const vf = schema["x-valueFormat"];
  if (typeof vf !== "string" || vf === "" || schema.format !== undefined) return undefined;
  if (type === "string" || (type === "integer" && isTimestampValueFormat(vf))) return vf;
  return undefined;
}

/** 按格式内容推断日期组件, 即 `@jotl/core` 的 valueFormatComponent. */
export const valueFormatWidget = valueFormatComponent;

/** 可空节点上描述内容的 x-ui: 内置字段组件名与 thousands summary; 其余 x-ui 作用于可空节点本身. */
function carriedUi(ui: JsonSchemaObject["x-ui"]): Record<string, unknown> | undefined {
  if (ui === undefined || typeof ui !== "object") return undefined;
  const carried: Record<string, unknown> = {};
  if (typeof ui.widget === "string" && isBuiltinWidget(ui.widget) && ui.widget !== "nullable") carried.widget = ui.widget;
  if (ui.thousands !== undefined) carried.thousands = ui.thousands;
  if (ui.summary !== undefined) carried.summary = ui.summary;
  return Object.keys(carried).length > 0 ? carried : undefined;
}

/**
 * 拆分出的内容节点. 可空节点(T | null 合并为类型数组)上的 x-ui 描述的是内容: 内置字段组件名与 thousands summary 带给内容节点,
 * 其余 x-ui 已作用于被拆分的节点; 联合的分支不带 x-ui.
 */
export function splitBranch(schema: JsonSchemaObject, type: JsonSchemaType, nullable: boolean): JsonSchemaObject {
  const { "x-ui": ui, ...rest } = schema;
  const branch: JsonSchemaObject = { ...rest, type };
  const carried = nullable ? carriedUi(ui) : undefined;
  if (carried !== undefined) branch["x-ui"] = carried;
  return branch;
}

/** `anyOf` / `oneOf: [T, null]` 的内容分支: 同 splitBranch 带上外层描述内容的 x-ui, 叠在分支自身的 x-ui 之上; 引用目标的 x-ui 仍按层合并. */
function nullableContent(outer: JsonSchemaObject, site: SchemaSite): SchemaSite {
  const carried = carriedUi(outer["x-ui"]);
  if (carried === undefined || !isSchemaObject(site.schema)) return site;
  return { ...site, schema: { ...site.schema, "x-ui": { ...site.schema["x-ui"], ...carried } } };
}

/** money / bigint 的值对象: properties.type 为 const "money" / "bigint" 的对象. */
export function decimalKind(schema: JsonSchemaObject): DecimalKind | undefined {
  const types = schemaTypes(schema);
  if (types.length > 0 && !(types.length === 1 && types[0] === "object")) return undefined;
  const tag = isSchemaObject(schema.properties) ? schema.properties.type : undefined;
  if (!isSchemaObject(tag)) return undefined;
  return tag.const === "money" || tag.const === "bigint" ? tag.const : undefined;
}

function nonEmptyArray(value: unknown): value is JsonSchema[] {
  return Array.isArray(value) && value.length > 0;
}

/** 只接受 null 的分支: `type: "null"`, `const: null` 或 `enum: [null]`. */
function isNullOnly(document: JsonSchema, schema: JsonSchema): boolean {
  const { effective } = resolveNode(document, { pointer: "", schema });
  if ("const" in effective) return effective.const === null;
  if (Array.isArray(effective.enum)) return effective.enum.length === 1 && effective.enum[0] === null;
  const types = schemaTypes(effective);
  return types.length === 1 && types[0] === "null";
}

function unionKeyword(schema: JsonSchemaObject): "oneOf" | "anyOf" | undefined {
  if (nonEmptyArray(schema.oneOf)) return "oneOf";
  if (nonEmptyArray(schema.anyOf)) return "anyOf";
  return undefined;
}

function isObjectLike(schema: JsonSchemaObject): boolean {
  const types = schemaTypes(schema);
  if (types.length > 0) return types.length === 1 && types[0] === "object";
  return schema.properties !== undefined || schema.additionalProperties !== undefined;
}

function isMapLike(schema: JsonSchemaObject): boolean {
  const extra = schema.additionalProperties;
  const hasProperties = isSchemaObject(schema.properties) && Object.keys(schema.properties).length > 0;
  return !hasProperties && (extra === true || isSchemaObject(extra));
}

function literalOf(document: JsonSchema, schema: JsonSchema | undefined): { value: unknown } | undefined {
  if (schema === undefined) return undefined;
  const { effective } = resolveNode(document, { pointer: "", schema });
  if ("const" in effective) return { value: effective.const };
  if (Array.isArray(effective.enum) && effective.enum.length === 1) return { value: effective.enum[0] };
  return undefined;
}

/** 可区分联合(D39): 各分支都是对象, 有同名必填字段, 且该字段在各分支中是互不相同的字面量; 取第一个分支中最先出现的这类字段. */
export function findDiscriminator(document: JsonSchema, branches: readonly JsonSchema[]): string | undefined {
  if (branches.length < 2) return undefined;
  const objects = branches.map((b) => resolveNode(document, { pointer: "", schema: b }).effective);
  if (!objects.every(isObjectLike)) return undefined;
  const [first] = objects;
  if (first === undefined) return undefined;
  for (const name of requiredKeys(first)) {
    const literals: unknown[] = [];
    for (const branch of objects) {
      const property = isSchemaObject(branch.properties) ? branch.properties[name] : undefined;
      const literal = requiredKeys(branch).has(name) ? literalOf(document, property) : undefined;
      if (literal === undefined || literals.some((seen) => jsonEqual(seen, literal.value))) break;
      literals.push(literal.value);
    }
    if (literals.length === objects.length) return name;
  }
  return undefined;
}

function itemsSchema(document: JsonSchema, node: JsonSchemaObject): JsonSchema | undefined {
  return node.items === undefined ? undefined : resolveNode(document, { pointer: "", schema: node.items }).effective;
}

export function shapeOf(document: JsonSchema, node: ResolvedNode): Shape {
  if (node.unresolvedRef !== undefined) return { kind: "unresolved", ref: node.unresolvedRef };
  const schema = node.effective;
  for (const keyword of UNSUPPORTED_KEYWORDS) if (keyword in schema) return { kind: "unsupported", feature: keyword };
  if (nonEmptyArray(schema.oneOf) && nonEmptyArray(schema.anyOf)) return { kind: "unsupported", feature: "oneOf + anyOf" };
  if ("const" in schema) return { kind: "const" };
  const options = enumOptions(schema);
  if (options !== undefined) return { kind: "enum", count: options.length };
  const union = unionKeyword(schema);
  if (union !== undefined) {
    const branches = schema[union] as JsonSchema[];
    if (branches.length === 2 && branches.some((b) => isNullOnly(document, b))) return { kind: "nullable" };
    const discriminator = findDiscriminator(document, branches);
    return discriminator === undefined ? { kind: "union" } : { kind: "union", discriminator };
  }
  const types = schemaTypes(schema);
  const concrete = types.filter((t) => t !== "null");
  if (types.length > 1) return concrete.length === 1 ? { kind: "nullable" } : { kind: "union" };
  const type = types[0] ?? inferType(schema);
  switch (type) {
    case "object": {
      const decimal = decimalKind(schema);
      if (decimal !== undefined) return { kind: decimal };
      return isMapLike(schema) ? { kind: "map" } : { kind: "object" };
    }
    case "array": {
      if (schema.prefixItems !== undefined) return { kind: "tuple" };
      const items = itemsSchema(document, schema);
      return items !== undefined && enumOptions(items) !== undefined ? { kind: "enumArray" } : { kind: "array" };
    }
    case "string": {
      const vf = valueFormatOf(schema, type);
      if (vf !== undefined) return { kind: "scalar", type, widget: valueFormatWidget(vf) };
      if (schema.contentMediaType === RICH_TEXT_MEDIA_TYPE) return { kind: "scalar", type, widget: "richtext" };
      if (schema.contentMediaType === JSON_TEXT_MEDIA_TYPE) return { kind: "scalar", type, widget: "json" };
      if (typeof schema.format === "string" && Object.hasOwn(FORMAT_WIDGETS, schema.format)) {
        return { kind: "scalar", type, widget: FORMAT_WIDGETS[schema.format]! };
      }
      return { kind: "scalar", type, widget: "input" };
    }
    case "number":
      return { kind: "scalar", type, widget: "number" };
    case "integer": {
      const vf = valueFormatOf(schema, type);
      return { kind: "scalar", type, widget: vf === undefined ? "number" : valueFormatWidget(vf) };
    }
    case "boolean":
      return { kind: "scalar", type, widget: "switch" };
    case "null":
      return { kind: "const" };
    default:
      return { kind: "json" };
  }
}

function inferType(schema: JsonSchemaObject): string | undefined {
  if (schema.properties !== undefined || schema.additionalProperties !== undefined) return "object";
  if (schema.items !== undefined || schema.prefixItems !== undefined) return "array";
  return undefined;
}

/** 无 x-ui 时该形态的内置组件名; 递归引用(tree)由 plan 按引用链判定. */
export function builtinWidgetOf(shape: Shape): BuiltinWidgetName {
  switch (shape.kind) {
    case "enum":
      return shape.count >= 2 ? "select" : "output";
    case "enumArray":
      return "select";
    case "scalar":
      return shape.widget;
    case "const":
      return "output";
    case "object":
      return "page";
    case "map":
      return "kv";
    case "array":
      return "list";
    case "money":
    case "bigint":
    case "tuple":
    case "nullable":
    case "union":
      return shape.kind;
    default:
      return FALLBACK_WIDGET;
  }
}

function originPointer(node: ResolvedNode, keyword: string): JsonPointer {
  return node.origin.get(keyword) ?? node.site.pointer;
}

/** 该形态下的子节点位置: 对象为每个属性(另有 schema 形式的 additionalProperties 时末尾加一个其余键的值模板), 字典与数组为一个元素模板, 元组按位置(items 允许剩余元素时末尾加一个剩余元素模板), 可空为非空分支, 联合为每个分支. */
export function childSites(document: JsonSchema, node: ResolvedNode, shape: Shape): ChildSite[] {
  const schema = node.effective;
  switch (shape.kind) {
    case "object": {
      const base = appendPointer(originPointer(node, "properties"), "properties");
      const sites: ChildSite[] = isSchemaObject(schema.properties)
        ? Object.entries(schema.properties).map(([key, child]) => ({ site: { pointer: appendPointer(base, key), schema: child as JsonSchema }, dataToken: key }))
        : [];
      // 有已声明属性又有 schema 形式的 additionalProperties: 其余键的值模板排在属性之后, 由对象组件的 "其他键" 区渲染.
      if (isSchemaObject(schema.additionalProperties)) {
        const pointer = appendPointer(originPointer(node, "additionalProperties"), "additionalProperties");
        sites.push({ site: { pointer, schema: schema.additionalProperties }, dataToken: WILDCARD_TOKEN });
      }
      return sites;
    }
    case "map": {
      const extra = schema.additionalProperties ?? true;
      return [{ site: { pointer: appendPointer(originPointer(node, "additionalProperties"), "additionalProperties"), schema: extra }, dataToken: WILDCARD_TOKEN }];
    }
    case "array":
    case "enumArray": {
      if (schema.items === undefined) return [{ site: { pointer: node.site.pointer, schema: true, virtual: true }, dataToken: WILDCARD_TOKEN }];
      return [{ site: { pointer: appendPointer(originPointer(node, "items"), "items"), schema: schema.items }, dataToken: WILDCARD_TOKEN }];
    }
    case "tuple": {
      const prefix = Array.isArray(schema.prefixItems) ? schema.prefixItems : [];
      const base = appendPointer(originPointer(node, "prefixItems"), "prefixItems");
      const sites: ChildSite[] = prefix.map((child, i) => ({ site: { pointer: appendPointer(base, i), schema: child }, dataToken: String(i) }));
      // items 允许剩余元素(true 或 schema)时, 剩余元素的模板排在各位置之后; false 或缺省时不加, 剩余元素不可增删.
      if (schema.items === true || isSchemaObject(schema.items)) {
        sites.push({ site: { pointer: appendPointer(originPointer(node, "items"), "items"), schema: schema.items }, dataToken: WILDCARD_TOKEN });
      }
      return sites;
    }
    case "nullable":
    case "union": {
      const keyword = unionKeyword(schema);
      if (keyword !== undefined) {
        const base = appendPointer(originPointer(node, keyword), keyword);
        const branches = (schema[keyword] as JsonSchema[]).map((child, i) => ({ site: { pointer: appendPointer(base, i), schema: child } }));
        if (shape.kind !== "nullable") return branches;
        return branches.filter((b) => !isNullOnly(document, b.site.schema)).map((b) => ({ site: nullableContent(schema, b.site) }));
      }
      const types = schemaTypes(schema) as JsonSchemaType[];
      const picked = shape.kind === "nullable" ? types.filter((t) => t !== "null") : types;
      return picked.map((t) => ({
        site: { pointer: node.site.pointer, schema: splitBranch(schema, t, shape.kind === "nullable"), virtual: true, origin: node.origin },
      }));
    }
    default:
      return [];
  }
}

const FORMAT_OF: Readonly<Partial<Record<BuiltinWidgetName, string>>> = {
  url: "uri",
  image: "uri",
  file: "uri",
  email: "email",
  date: "date",
  time: "time",
  datetime: "date-time",
  color: "color",
};

function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 内置组件名接受的数据形态(契约 C2); 不接受时按 F2 降级到该形态的默认组件. 非内置名返回 undefined, 只看注册项的 accepts.
 * form field output json tree 接受任意形态.
 */
export function acceptsShape(name: string, shape: Shape, schema: JsonSchemaObject): boolean | undefined {
  if (!isBuiltinWidget(name)) return undefined;
  const scalar = shape.kind === "scalar" ? shape.type : undefined;
  switch (name) {
    case "form":
    case "field":
    case "output":
    case "json":
    case "tree":
      return true;
    case "page":
    case "inline":
      return shape.kind === "object";
    case "input":
    case "textarea":
    case "password":
    case "richtext":
      return scalar === "string";
    case "number":
      return scalar === "number" || scalar === "integer";
    case "range":
      return (scalar === "number" || scalar === "integer") && isFiniteNumber(schema.minimum) && isFiniteNumber(schema.maximum);
    case "money":
    case "bigint":
      return shape.kind === name;
    case "switch":
      return scalar === "boolean";
    case "checkbox":
      return scalar === "boolean" || shape.kind === "enumArray";
    case "select":
      return shape.kind === "enum" || shape.kind === "enumArray";
    case "radio":
      return shape.kind === "enum";
    case "date":
    case "time":
    case "datetime": {
      const vf = valueFormatOf(schema, scalar);
      if (vf !== undefined) return name !== "time" || !isTimestampValueFormat(vf);
      return scalar === "string" && schema.format === FORMAT_OF[name];
    }
    case "url":
    case "email":
    case "color":
    case "image":
    case "file":
      return scalar === "string" && schema.format === FORMAT_OF[name];
    case "list":
      return shape.kind === "array" || shape.kind === "enumArray";
    case "tuple":
      return shape.kind === "tuple";
    case "kv":
      return shape.kind === "map";
    case "union":
      return shape.kind === "union";
    case "nullable":
      return shape.kind === "nullable";
  }
}

/** 内置匹配规则: 无 x-ui 时 schema 节点得到的组件名; document 用于解析 $ref, 递归引用(tree)只在 plan 中判定. */
export function matchBuiltinWidget(schema: JsonSchema, document: JsonSchema = schema): BuiltinWidgetName {
  return builtinWidgetOf(shapeOf(document, resolveNode(document, { pointer: "", schema })));
}

/** 只按 schema 判断内置组件名能否处理该节点(不看注册表); 非内置名返回 undefined. 供语言服务与组件包使用. */
export function builtinAccepts(name: string, schema: JsonSchema, document: JsonSchema = schema): boolean | undefined {
  const node = resolveNode(document, { pointer: "", schema });
  return acceptsShape(name, shapeOf(document, node), node.effective);
}
