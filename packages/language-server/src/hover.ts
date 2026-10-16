// 悬停(E4): 内置组件, 扩展组件, 元数据键与标识记号显示说明; 类型名, 类型引用与字段键经 SourceMap 显示编译后的 JSON Schema 片段.
import { formatMessage, lookupPointer } from "@jotl/core";
import { compile, EXTENSION_CONSTRAINT_KEYS, type JotlFile, META_KEYS, type MetaTarget, parse } from "@jotl/core";
import { type Hover, MarkupKind, type Position } from "vscode-languageserver";
import { hoverDocs } from "./hover-docs.js";
import { compileOptions, extensionSchema, type LanguageServiceOptions, withFileWidgets } from "./options.js";
import { collectOccurrences, fileWidgetNames, fileWidgetSchemas, findDeclaration, type Occurrence, occurrenceAt } from "./symbol-index.js";
import { offsetAt, positionAt } from "./text-position.js";

/** 悬停卡片中 JSON 片段的最大行数; 超出部分截断并注明总行数. */
export const MAX_FRAGMENT_LINES = 60;

const BUILTIN_PROBE_FILE = "builtin.jotl";
const BUILTIN_PROBE_NAME = "T";
/** 单独写组件名编译不过的组件, 用最小的完整写法探测编译结果. */
const PROBE_SOURCES: Readonly<Record<string, string>> = {
  enum: "enum{ a b }",
  array: "array[array_item: 'string']",
  map: "map[map_item: 'string']",
  union: "union[union_item: 'number|string']",
};

/** 代码块的围栏要比内容中最长的连续反引号更长, 否则描述里的反引号会提前结束代码块. */
function codeBlock(content: string, language: string): string {
  const longest = Math.max(0, ...[...content.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${content}\n${fence}`;
}

function jsonBlock(value: unknown): string {
  const lines = JSON.stringify(value, null, 2).split("\n");
  if (lines.length <= MAX_FRAGMENT_LINES) return codeBlock(lines.join("\n"), "json");
  const shown = lines.slice(0, MAX_FRAGMENT_LINES).join("\n");
  return `${codeBlock(`${shown}\n…`, "json")}\n\n${formatMessage(hoverDocs().text.truncated, { shown: MAX_FRAGMENT_LINES, total: lines.length })}`;
}

function heading(kind: string, name: string, label?: string): string {
  const suffix = label === undefined || label === "" ? "" : ` ${label}`;
  return `${kind} \`${name}\`${suffix}`;
}

const builtinSchemas = new Map<string, unknown>();

/** 内置组件的编译结果直接取自编译器, 文案里不重复书写映射. */
function builtinSchema(name: string): unknown {
  if (builtinSchemas.has(name)) return builtinSchemas.get(name);
  const source = `${BUILTIN_PROBE_NAME}: ${PROBE_SOURCES[name] ?? name}`;
  const compiled = compile(source, BUILTIN_PROBE_FILE).value;
  const schema = compiled === undefined ? undefined : lookupPointer(compiled.schema, `/$defs/${BUILTIN_PROBE_NAME}`).value;
  builtinSchemas.set(name, schema);
  return schema;
}

function componentHover(name: string): string | undefined {
  const { components, text } = hoverDocs();
  const doc = Object.hasOwn(components, name) ? components[name] : undefined;
  if (doc === undefined) return undefined;
  const schema = builtinSchema(name);
  const parts = [heading(text.component, name), doc];
  if (schema !== undefined) parts.push(`${text.compilesTo}:\n\n${jsonBlock(schema)}`);
  return parts.join("\n\n");
}

function targetLabel(target: MetaTarget): string {
  if (target === "ref") return hoverDocs().text.refTarget;
  if (target === "ext") return hoverDocs().text.extTarget;
  return `\`${target}\``;
}

function metaKeyHover(name: string): string | undefined {
  const { metaKeys, text } = hoverDocs();
  const doc = Object.hasOwn(metaKeys, name) ? metaKeys[name] : undefined;
  const rule = Object.hasOwn(META_KEYS, name) ? META_KEYS[name] : undefined;
  if (doc === undefined || rule === undefined) return undefined;
  const constraint = rule.targets !== "any" && !rule.targets.includes("ext") && Object.values(EXTENSION_CONSTRAINT_KEYS).some((keys) => keys.includes(name));
  const applies = rule.targets === "any" ? text.anyTarget : [...rule.targets.map(targetLabel), ...(constraint ? [text.extConstraintTarget] : [])].join(" ");
  const parts = [heading(text.metaKey, name), doc, `${text.appliesTo}: ${applies}`];
  if (rule.rootOnly) parts.push(text.rootOnly);
  return parts.join("\n\n");
}

/** 按键名起点在 SourceMap 中找到类型或字段对应的 schema 节点; 文件有错误时返回 undefined. */
function schemaFragment(text: string, uri: string, keyStart: number, options: LanguageServiceOptions) {
  const compiled = compile(text, uri, compileOptions(options)).value;
  if (compiled === undefined) return undefined;
  for (const [pointer, span] of compiled.sourceMap) {
    if (span.keyRange?.start.offset === keyStart) return lookupPointer(compiled.schema, pointer);
  }
  return { found: false, value: undefined };
}

function schemaHover(text: string, uri: string, title: string, keyStart: number, options: LanguageServiceOptions): string {
  const fragment = schemaFragment(text, uri, keyStart, options);
  if (fragment === undefined) return `${title}\n\n${hoverDocs().text.compileFailed}`;
  return fragment.found ? `${title}\n\n${jsonBlock(fragment.value)}` : title;
}

function hoverMarkdown(text: string, uri: string, target: Occurrence, all: readonly Occurrence[], options: LanguageServiceOptions, file: JotlFile) {
  const docs = hoverDocs();
  const labels = docs.text;
  switch (target.kind) {
    case "component":
      return componentHover(target.name);
    case "metaKey":
      return metaKeyHover(target.name);
    case "marker":
      return [heading(labels.marker, `<${target.name}/>`), docs.markers[target.name]].join("\n\n");
    case "declaration":
      return schemaHover(text, uri, heading(labels.declaration, target.name, target.entry.label?.text), target.start, options);
    case "typeReference": {
      const declaration = findDeclaration(all, target.name);
      if (declaration?.kind === "declaration") {
        return schemaHover(text, uri, heading(labels.declaration, target.name, declaration.entry.label?.text), declaration.start, options);
      }
      // 文件内声明只并入这里; 并入后传给 compileOptions 会把这些名字按 `string` 补登.
      const base = extensionSchema(withFileWidgets(options, fileWidgetNames(file), fileWidgetSchemas(file)), target.name);
      return base === undefined ? undefined : [heading(labels.extension, target.name), `${labels.extensionDoc}:\n\n${jsonBlock(base)}`].join("\n\n");
    }
    case "field":
      return schemaHover(text, uri, heading(labels.field, target.name, target.entry.label?.text), target.start, options);
  }
}

export function getHover(text: string, uri: string, position: Position, options: LanguageServiceOptions = {}): Hover | null {
  const file = parse(text, uri).value;
  if (file === undefined) return null;
  const all = collectOccurrences(file);
  const target = occurrenceAt(all, offsetAt(text, position));
  if (target === undefined) return null;
  const markdown = hoverMarkdown(text, uri, target, all, options, file);
  if (markdown === undefined) return null;
  return {
    contents: { kind: MarkupKind.Markdown, value: markdown },
    range: { start: positionAt(text, target.start), end: positionAt(text, target.end) },
  };
}
