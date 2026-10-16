// Jotl v1 源码的抽象语法树类型(定稿 §3 §4 §7); 每个节点带源码位置.
import type { SourceRange, SourceSpan } from "../schema/index.js";

export interface Identifier {
  kind: "Identifier";
  name: string;
  span: SourceSpan;
}

/** 字符串字面量或元数据对象的键; raw 为源码原文(标识符键无引号). */
export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
  raw: string;
  span: SourceSpan;
}

/** `(` 到配对的 `)` 之间去掉转义与首尾空白后的文本; span 含两侧括号. */
export interface Label {
  kind: "Label";
  text: string;
  span: SourceSpan;
}

export interface Comment {
  kind: "LineComment" | "BlockComment";
  /** 含注释标记的原文. */
  text: string;
  range: SourceRange;
}

export type LiteralScalar = string | number | boolean | null;

export interface LiteralValue {
  kind: "LiteralValue";
  value: LiteralScalar;
  /** 源码原文, 例如 `'aA'` 或 `0x10`. */
  raw: string;
  span: SourceSpan;
}

export interface ArrayValue {
  kind: "ArrayValue";
  items: ValueNode[];
  span: SourceSpan;
}

export interface ObjectValueMember {
  key: StringLiteral;
  value: ValueNode;
}

export interface ObjectValue {
  kind: "ObjectValue";
  members: ObjectValueMember[];
  span: SourceSpan;
}

/** 元数据中的 JSON5 值. */
export type ValueNode = LiteralValue | ArrayValue | ObjectValue;

/** `<root/>` 或 `<default/>`. */
export interface Marker {
  kind: "Marker";
  name: "root" | "default";
  span: SourceSpan;
}

/**
 * 条目的键. form 为写法: 标识符, 引号字符串, 数字, 或 `*`.
 * name 为作为字段键的取值(数字取原文); value 为作为枚举成员或分支值的取值(标识符 `true` `false` 为布尔, 数字为数值).
 */
export interface Key {
  kind: "Key";
  form: "identifier" | "string" | "number" | "star";
  name: string;
  value: LiteralScalar;
  raw: string;
  span: SourceSpan;
}

/** `[...]`: 组件与体之间的元数据, 成员同 JSON5 对象. */
export interface Meta {
  kind: "Meta";
  members: ObjectValueMember[];
  span: SourceSpan;
}

/** `{...}`: 体的内容(字段, 枚举成员, 元组位置或 union 分支)由组件决定. */
export interface Body {
  kind: "Body";
  entries: Entry[];
  span: SourceSpan;
}

/**
 * 条目: 顶层类型, 字段, 元组位置, union 分支或枚举成员.
 * 没有冒号时 component meta body 通常为空; 枚举成员可带 meta; 缺冒号的错误写法也会把内容放进来.
 */
export interface Entry {
  kind: "Entry";
  /** 只出现在顶层条目上. */
  markers: Marker[];
  key: Key;
  label: Label | undefined;
  /** `?` 的位置; 没写时为 undefined. */
  question: SourceRange | undefined;
  /** `:` 的位置; 没写时为 undefined. */
  colon: SourceRange | undefined;
  component: Identifier | undefined;
  meta: Meta | undefined;
  body: Body | undefined;
  /** range 为整个条目(不含标识与分隔符), keyRange 为键. */
  span: SourceSpan;
}

export interface JotlFile {
  kind: "File";
  file: string;
  /** 顶层条目, 按出现顺序. */
  entries: Entry[];
  /** 全部注释, 按出现顺序; 供格式化与编辑器使用. */
  comments: Comment[];
  span: SourceSpan;
}
