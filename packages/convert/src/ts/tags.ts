// TS 协议的 JSDoc 标签表: 自定义标签, 关键字与标签的对应, 以及读取时兼容的别名; 正反两个方向与 lint 预设共用.

export type TagSyntax = "block" | "modifier";

export interface CustomTagDefinition {
  name: string;
  syntax: TagSyntax;
}

/** docs/tag-protocol.md 中的全部自定义标签; 必须与包根的 `tsdoc.json` 的 `tagDefinitions` 一致. */
export const CUSTOM_TAGS: readonly CustomTagDefinition[] = [
  { name: "title", syntax: "block" },
  { name: "writeOnly", syntax: "modifier" },
  { name: "uniqueItems", syntax: "modifier" },
  { name: "minimum", syntax: "block" },
  { name: "maximum", syntax: "block" },
  { name: "exclusiveMinimum", syntax: "block" },
  { name: "exclusiveMaximum", syntax: "block" },
  { name: "multipleOf", syntax: "block" },
  { name: "minLength", syntax: "block" },
  { name: "maxLength", syntax: "block" },
  { name: "pattern", syntax: "block" },
  { name: "format", syntax: "block" },
  { name: "minItems", syntax: "block" },
  { name: "maxItems", syntax: "block" },
  { name: "minProperties", syntax: "block" },
  { name: "maxProperties", syntax: "block" },
  { name: "contentMediaType", syntax: "block" },
  { name: "contentEncoding", syntax: "block" },
  { name: "asType", syntax: "block" },
  { name: "ui", syntax: "block" },
  { name: "widget", syntax: "block" },
  { name: "itemUi", syntax: "block" },
  { name: "itemWidget", syntax: "block" },
  { name: "enumTitles", syntax: "block" },
  { name: "enumDescriptions", syntax: "block" },
  { name: "branchTitles", syntax: "block" },
  { name: "errorMessage", syntax: "block" },
  { name: "valueFormat", syntax: "block" },
  { name: "id", syntax: "block" },
  { name: "rules", syntax: "block" },
  { name: "widgets", syntax: "block" },
  { name: "root", syntax: "modifier" },
];

/** TSDoc 内置但不在 JSDoc 标准标签集中的标签, eslint-plugin-jsdoc 需要额外声明. */
export const TSDOC_ONLY_TAGS: readonly string[] = ["defaultValue", "privateRemarks"];

/** 取值为数字的约束关键字, 标签名与关键字同名. */
export const NUMERIC_KEYWORDS = [
  "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minItems", "maxItems", "minProperties", "maxProperties",
] as const;

/** 取值原样为文本的关键字, 标签名与关键字同名. */
export const TEXT_KEYWORDS = ["title", "format", "contentMediaType", "contentEncoding"] as const;

/** 扩展关键字与同义的自定义标签, 取值原样为文本. */
export const EXTENSION_TEXT_TAGS: Readonly<Record<string, string>> = { "x-valueFormat": "valueFormat" };

/** 读取时接受的标签名(小写)到规范标签名; 别名按 docs/tag-protocol.md 与 ts-json-schema-generator 的习惯写法. */
export const TAG_ALIASES: Readonly<Record<string, string>> = {
  default: "defaultValue",
  defaultvalue: "defaultValue",
  readonly: "readonly",
  examples: "examples",
  example: "example",
  comment: "privateRemarks",
  privateremarks: "privateRemarks",
  deprecated: "deprecated",
  description: "description",
  ...Object.fromEntries(CUSTOM_TAGS.map((t) => [t.name.toLowerCase(), t.name])),
};

/** 读取时静默忽略的 TSDoc 标准标签: 它们不对应 JSON Schema 关键字. */
export const IGNORED_TSDOC_TAGS: ReadonlySet<string> = new Set([
  "alpha", "beta", "decorator", "eventproperty", "experimental", "inheritdoc", "internal", "label", "link",
  "override", "packagedocumentation", "param", "public", "remarks", "returns", "see", "sealed", "throws",
  "typeparam", "virtual",
]);

/** 无说明文字的 `@deprecated` 写入的默认文本; 读取时不产生 `x-deprecatedReason`. */
export const DEPRECATED_DEFAULT_TEXT = "已弃用.";
export const DEPRECATED_DEFAULT_TEXT_EN = "Deprecated.";
/** 读回时视为默认说明的文本, 两种语言生成的都不产生 x-deprecatedReason. */
export const DEPRECATED_DEFAULT_TEXTS: readonly string[] = [DEPRECATED_DEFAULT_TEXT, DEPRECATED_DEFAULT_TEXT_EN];

/** `@enumTitles` 的键: 字符串取其本身, 其余取 JSON 文本(docs/tag-protocol.md). */
export function enumTitleKey(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
