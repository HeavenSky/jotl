// 版本识别: `$schema` 优先, 其次调用方指定, 最后按特征关键字推断; 无法判定时要求调用方指定.
import { type Diagnostic, type JsonPointer, type Result, appendPointer, fail, isSchemaObject, ok } from "@jotl/core";
import { upgradeDiagnostic } from "./diagnostics.js";
import { locate as at } from "./transform.js";
import { type DraftVersion, KEYWORD_INTRODUCED, type SchemaVersion, draftRank, isSchemaVersion, matchDialect } from "./versions.js";

export type VersionSource = "declared" | "specified" | "inferred";

export interface VersionDetection {
  version: SchemaVersion;
  source: VersionSource;
}

export interface DetectOptions {
  /** 没有可识别的 `$schema` 时采用的版本; OpenAPI 3.0 / Swagger 2.0 的 Schema Object 通常需要指定. */
  version?: SchemaVersion;
  /** 写入诊断位置的文档标识. */
  uri?: string;
}

interface Feature {
  keyword: string;
  pointer: JsonPointer;
}

interface Features {
  draft03?: Feature;
  swagger?: Feature;
  openapi?: Feature;
  oldest?: Feature & { version: DraftVersion };
  newest?: Feature & { version: DraftVersion };
}

const SINGLE = [
  "additionalProperties", "additionalItems", "contains", "propertyNames", "not", "if", "then", "else",
  "unevaluatedItems", "unevaluatedProperties", "contentSchema",
];
const ARRAY = ["prefixItems", "allOf", "anyOf", "oneOf"];
const MAP = ["properties", "patternProperties", "definitions", "$defs", "dependentSchemas", "dependencies"];

/** 各版本中可能出现子 schema 的位置, 不区分版本. */
function forEachSubschema(node: Record<string, unknown>, pointer: JsonPointer, visit: (child: unknown, at: JsonPointer) => void): void {
  for (const k of SINGLE) if (k in node) visit(node[k], appendPointer(pointer, k));
  const items = node.items;
  if (Array.isArray(items)) {
    items.forEach((c, i) => {
      visit(c, appendPointer(pointer, "items", i));
    });
  } else if (items !== undefined) visit(items, appendPointer(pointer, "items"));
  for (const k of ARRAY) {
    const value = node[k];
    if (Array.isArray(value)) {
      value.forEach((c, i) => {
        visit(c, appendPointer(pointer, k, i));
      });
    }
  }
  for (const k of MAP) {
    const value = node[k];
    if (!isSchemaObject(value)) continue;
    for (const [name, child] of Object.entries(value)) {
      if (!Array.isArray(child)) visit(child, appendPointer(pointer, k, name));
    }
  }
}

function considerOld(features: Features, keyword: string, pointer: JsonPointer, version: DraftVersion): void {
  if (features.oldest === undefined || draftRank(version) < draftRank(features.oldest.version)) {
    features.oldest = { keyword, pointer, version };
  }
}

function considerNew(features: Features, keyword: string, pointer: JsonPointer, version: DraftVersion): void {
  if (features.newest === undefined || draftRank(version) > draftRank(features.newest.version)) {
    features.newest = { keyword, pointer, version };
  }
}

function scanNode(node: Record<string, unknown>, pointer: JsonPointer, features: Features): void {
  const at = (k: string): Feature => ({ keyword: k, pointer: appendPointer(pointer, k) });
  if (typeof node.required === "boolean") features.draft03 ??= at("required");
  for (const k of ["extends", "disallow", "divisibleBy"]) if (k in node) features.draft03 ??= at(k);

  if (typeof node["x-nullable"] === "boolean") features.swagger ??= at("x-nullable");
  if (node.type === "file") features.swagger ??= at("type");
  if (typeof node.discriminator === "string") features.swagger ??= at("discriminator");
  if (typeof node.nullable === "boolean") features.openapi ??= at("nullable");
  if (isSchemaObject(node.discriminator)) features.openapi ??= at("discriminator");

  if (typeof node.id === "string") considerOld(features, "id", appendPointer(pointer, "id"), "draft-04");
  for (const k of ["exclusiveMaximum", "exclusiveMinimum"]) {
    if (typeof node[k] === "boolean") considerOld(features, k, appendPointer(pointer, k), "draft-04");
    if (typeof node[k] === "number") considerNew(features, k, appendPointer(pointer, k), "draft-06");
  }
  if (isSchemaObject(node.definitions)) considerOld(features, "definitions", appendPointer(pointer, "definitions"), "draft-04");
  if (isSchemaObject(node.dependencies)) considerOld(features, "dependencies", appendPointer(pointer, "dependencies"), "draft-04");
  if (Array.isArray(node.items)) considerOld(features, "items", appendPointer(pointer, "items"), "draft-04");
  if ("additionalItems" in node) considerOld(features, "additionalItems", appendPointer(pointer, "additionalItems"), "draft-04");
  for (const k of ["$recursiveRef", "$recursiveAnchor"]) {
    if (k in node) considerOld(features, k, appendPointer(pointer, k), "2019-09");
  }
  for (const k of Object.keys(node)) {
    const introduced = KEYWORD_INTRODUCED[k];
    if (introduced !== undefined && introduced !== "draft-04") considerNew(features, k, appendPointer(pointer, k), introduced);
  }
}

function collectFeatures(schema: unknown): Features {
  const features: Features = {};
  const visit = (node: unknown, pointer: JsonPointer): void => {
    if (!isSchemaObject(node)) return;
    scanNode(node, pointer, features);
    forEachSubschema(node, pointer, visit);
  };
  visit(schema, "");
  return features;
}

/**
 * V12: 有旧版特征时取其中对应的最低版本, 其余高版本关键字交给宽松模式;
 * 只有新版特征时取它们共同支持的最低版本; draft-03 特征直接报错.
 */
function inferVersion(schema: unknown, uri: string | undefined): Result<VersionDetection> {
  const features = collectFeatures(schema);
  if (features.draft03) {
    return fail([
      upgradeDiagnostic("JOTL3002", { evidence: features.draft03.keyword }, { location: at(features.draft03.pointer, uri) }),
    ]);
  }
  let chosen: (Feature & { version: SchemaVersion }) | undefined;
  if (features.swagger) chosen = { ...features.swagger, version: "swagger-2.0" };
  else if (features.openapi) chosen = { ...features.openapi, version: "openapi-3.0" };
  else chosen = features.oldest ?? features.newest;
  if (chosen === undefined) return fail([upgradeDiagnostic("JOTL3001", {}, { location: at("", uri) })]);
  const note = upgradeDiagnostic(
    "JOTL3007",
    { keyword: chosen.keyword, version: chosen.version },
    { location: at(chosen.pointer, uri) },
  );
  return ok({ version: chosen.version, source: "inferred" }, [note]);
}

export function detectVersion(schema: unknown, options: DetectOptions = {}): Result<VersionDetection> {
  const { uri } = options;
  if (typeof schema !== "boolean" && !isSchemaObject(schema)) {
    return fail([upgradeDiagnostic("JOTL3003", {}, { location: at("", uri) })]);
  }
  if (options.version !== undefined && !isSchemaVersion(options.version)) {
    return fail([upgradeDiagnostic("JOTL3009", { version: String(options.version) }, { location: at("", uri) })]);
  }
  const diagnostics: Diagnostic[] = [];
  const declared = isSchemaObject(schema) ? schema.$schema : undefined;
  if (typeof declared === "string") {
    const match = matchDialect(declared);
    const location = at("/$schema", uri);
    if (match.kind === "draft-03") {
      return fail([upgradeDiagnostic("JOTL3002", { evidence: "$schema" }, { location })]);
    }
    if (match.kind === "version") {
      if (options.version !== undefined && options.version !== match.version) {
        diagnostics.push(
          upgradeDiagnostic("JOTL3006", { declared: match.version, option: options.version }, { location }),
        );
      }
      return ok({ version: match.version, source: "declared" }, diagnostics);
    }
    diagnostics.push(
      options.version !== undefined
        ? upgradeDiagnostic("JOTL3004", { uri: declared, version: options.version }, { location })
        : upgradeDiagnostic("JOTL3005", { uri: declared }, { location }),
    );
  }
  if (options.version !== undefined) return ok({ version: options.version, source: "specified" }, diagnostics);
  const inferred = inferVersion(schema, uri);
  return { value: inferred.value, diagnostics: [...diagnostics, ...inferred.diagnostics] };
}
