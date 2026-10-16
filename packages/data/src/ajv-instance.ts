// 创建与缓存校验用的 Ajv 实例: 2020-12 方言, ajv-formats, 自定义 color 格式与 Jotl 扩展关键字.
import { Ajv2020, _, type KeywordCxt, type Options, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { type JsonSchema, isValueFormatAlias } from "@jotl/core";
import { countDecimals, rangeViolation } from "./decimal.js";
import { isValidValueFormatValue } from "./value-format.js";

// ajv-formats 是 CJS 包, NodeNext 下默认导入得到的是模块对象.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

// 必须与 packages/data/test/fixtures-self-check.test.ts 中的 color 正则一致, 否则样例自检与校验结论分叉.
export const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Ajv 只把它们当注解; errorMessage 由错误转换阶段解释. */
export const JOTL_KEYWORDS = ["x-ui", "x-deprecatedReason", "errorMessage"] as const;

const BASE_OPTIONS: Options = {
  allErrors: true,
  // 错误转换按 parentSchema 的对象身份折叠组合关键字的分支错误, 关掉 verbose 会丢失 parentSchema.
  verbose: true,
  strict: false,
  strictSchema: true,
  strictNumbers: true,
  allowUnionTypes: true,
  // 关掉后字段名为 constructor, toString 等时, 缺少该字段会被原型链上的同名属性当作已填写.
  ownProperties: true,
};

export function createAjv(overrides: Options = {}): Ajv2020 {
  const ajv = new Ajv2020({ ...BASE_OPTIONS, ...overrides });
  addFormats(ajv);
  ajv.addFormat("color", COLOR_PATTERN);
  for (const keyword of JOTL_KEYWORDS) ajv.addKeyword({ keyword });
  // Ajv 8 的 2020 词汇表漏登记 $anchor(引用解析照常识别它), strictSchema 下会报 unknown keyword.
  if (!ajv.getKeyword("$anchor")) ajv.addKeyword({ keyword: "$anchor", schemaType: "string" });
  // 违反时 Ajv 只给出关键字, 违反的边界与位数由错误转换阶段按 error.schema 与 error.data 重新计算.
  ajv.addKeyword({
    keyword: "x-decimals",
    type: "number",
    schemaType: "number",
    errors: false,
    validate: (limit: number, data: number) => countDecimals(data) <= limit,
  });
  // 别名与 format: date-time 同时出现时由 format 断言, 不重复报错.
  ajv.addKeyword({
    keyword: "x-valueFormat",
    schemaType: "string",
    errors: false,
    validate: (fmt: string, data: unknown, parentSchema?: { format?: unknown }) =>
      (isValueFormatAlias(fmt) && parentSchema?.format === "date-time") || isValidValueFormatValue(fmt, data),
  });
  ajv.addKeyword({
    keyword: "x-decimalRange",
    type: "object",
    schemaType: "object",
    errors: false,
    validate: (range: unknown, data: Record<string, unknown>) => rangeViolation(range, data["value"]) === undefined,
  });
  return ajv;
}

function isJsonText(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 让 contentMediaType: application/json 与 contentSchema 成为断言(2020-12 中二者只是注解).
 * 只装在 validate 用的共享实例上: 装进 createAjv 会让官方测试集 content.json 的用例改变结论.
 * contentSchema 作为子 schema 编译进根 schema, 其中的 $ref 按根 schema 解析; 内部错误由错误转换阶段折叠为一条.
 */
export function enableJsonContent(ajv: Ajv2020): void {
  ajv.removeKeyword("contentMediaType");
  ajv.removeKeyword("contentSchema");
  ajv.addKeyword({
    keyword: "contentMediaType",
    type: "string",
    schemaType: "string",
    errors: false,
    validate: (mediaType: string, data: string) => mediaType !== "application/json" || isJsonText(data),
  });
  ajv.addKeyword({
    keyword: "contentSchema",
    type: "string",
    schemaType: ["object", "boolean"],
    code(cxt: KeywordCxt) {
      const { gen, data, parentSchema } = cxt;
      if (parentSchema.contentMediaType !== "application/json") return;
      const parsed = gen.let("parsed");
      const parsedOk = gen.let("parsedOk", true);
      gen.try(
        () => gen.assign(parsed, _`JSON.parse(${data})`),
        () => gen.assign(parsedOk, false),
      );
      const valid = gen.name("valid");
      gen.var(valid, true);
      gen.if(parsedOk, () => {
        cxt.subschema({ keyword: "contentSchema", data: parsed, dataTypes: [], compositeRule: true }, valid);
        gen.if(_`!${valid}`, () => cxt.error(true));
      });
      cxt.ok(valid);
    },
  });
}

/** 规范允许任意 `x-` 扩展关键字(元数据 `x_*`, 迁移的 `x-fengdie` 等); strictSchema 下未登记的会让整个 schema 编译失败, 这里登记为注解. */
function registerExtensionKeywords(ajv: Ajv2020, value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) registerExtensionKeywords(ajv, item);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("x-") && !ajv.getKeyword(key)) ajv.addKeyword({ keyword: key });
      registerExtensionKeywords(ajv, child);
    }
  }
}

export type CompileOutcome = { ok: true; validate: ValidateFunction } | { ok: false; error: unknown };

let shared: Ajv2020 | undefined;
const objectCache = new WeakMap<object, CompileOutcome>();
const booleanCache = new Map<boolean, CompileOutcome>();

function sharedAjv(): Ajv2020 {
  if (shared === undefined) {
    shared = createAjv();
    enableJsonContent(shared);
  }
  return shared;
}

/** 按 schema 对象身份缓存编译结果; 调用方改动了同一个 schema 对象后需要换新对象才会重新编译. */
export function compileSchema(schema: JsonSchema): CompileOutcome {
  const cached = typeof schema === "boolean" ? booleanCache.get(schema) : objectCache.get(schema);
  if (cached) return cached;
  shared = sharedAjv();
  let outcome: CompileOutcome;
  try {
    registerExtensionKeywords(shared, schema);
    outcome = { ok: true, validate: shared.compile(schema) };
  } catch (error) {
    outcome = { ok: false, error };
  }
  // 编译后立即从 Ajv 内部注册表移除: 否则 Ajv 的强引用缓存让 WeakMap 失效, 且同 $id 的新对象会编译失败.
  if (typeof schema !== "boolean") shared.removeSchema(schema);
  if (typeof schema === "boolean") booleanCache.set(schema, outcome);
  else objectCache.set(schema, outcome);
  return outcome;
}

const subschemaCache = new WeakMap<object, WeakMap<object, CompileOutcome>>();
const SUBSCHEMA_KEY = "__jotl_at";
let subschemaSeq = 0;

/**
 * 编译文档内的子 schema(或由文档节点合成的 schema): 放进文档浅拷贝的 $defs 中按片段取出, 其中的引用因此在文档内解析.
 * 按 (文档, 子 schema) 对象身份缓存; 编译后同样从 Ajv 注册表移除.
 */
export function compileSubschema(document: JsonSchema, schema: JsonSchema): CompileOutcome {
  if (typeof schema === "boolean" || typeof document === "boolean") return compileSchema(schema);
  const perDocument = subschemaCache.get(document) ?? new WeakMap<object, CompileOutcome>();
  subschemaCache.set(document, perDocument);
  const cached = perDocument.get(schema);
  if (cached) return cached;
  const ajv = sharedAjv();
  // 子 schema 自带的 $id 会与它在文档中的原位置重复登记, $schema 只允许出现在资源根上.
  const { $id: _id, $schema: _schema, ...entry } = schema;
  const id = typeof document.$id === "string" && document.$id !== "" ? document.$id.replace(/#$/, "") : `urn:jotl:data:subschema:${++subschemaSeq}`;
  const defs = typeof document.$defs === "object" && document.$defs !== null ? document.$defs : {};
  const wrapper = { ...document, $id: id, $defs: { ...defs, [SUBSCHEMA_KEY]: "$id" in schema || "$schema" in schema ? entry : schema } };
  const ref = `${id}#/$defs/${SUBSCHEMA_KEY}`;
  let outcome: CompileOutcome;
  try {
    registerExtensionKeywords(ajv, wrapper);
    ajv.addSchema(wrapper);
    const validate = ajv.getSchema(ref);
    outcome = validate === undefined ? { ok: false, error: new Error(`cannot resolve ${ref}`) } : { ok: true, validate };
  } catch (error) {
    outcome = { ok: false, error };
  } finally {
    ajv.removeSchema(ref);
    ajv.removeSchema(wrapper);
  }
  perDocument.set(schema, outcome);
  return outcome;
}
