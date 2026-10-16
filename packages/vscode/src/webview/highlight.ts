// 预览中 JSON Schema 与 TS 文本的语法着色: 把文本切成带种类的片段, 由界面渲染成 span, 颜色取自 VS Code 主题变量; 只覆盖生成产物用到的语法.

export type TokenKind = "comment" | "doctag" | "string" | "number" | "keyword" | "literal" | "type" | "property" | "plain";

export interface Token {
  kind: TokenKind;
  text: string;
}

export type CodeLanguage = "json" | "typescript";

const KEYWORDS = new Set([
  "export", "default", "interface", "type", "extends", "import", "from", "const", "let", "readonly", "declare", "namespace", "enum", "keyof", "typeof", "in", "as", "is", "infer",
]);
const PRIMITIVE_TYPES = new Set(["string", "number", "boolean", "bigint", "object", "unknown", "any", "never", "void", "symbol"]);
const LITERALS = new Set(["true", "false", "null", "undefined"]);

/** 依次尝试; 每条都是 sticky 匹配, 第一个命中的决定片段种类. */
const RULES: readonly [RegExp, TokenKind | "word"][] = [
  [/\/\/[^\n]*/y, "comment"],
  [/\/\*[\s\S]*?(?:\*\/|$)/y, "comment"],
  [/"(?:[^"\\\n]|\\.)*"?/y, "string"],
  [/'(?:[^'\\\n]|\\.)*'?/y, "string"],
  [/`(?:[^`\\]|\\[\s\S])*`?/y, "string"],
  [/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y, "number"],
  [/[A-Za-z_$][\w$]*/y, "word"],
  [/\s+/y, "plain"],
  [/[\s\S]/y, "plain"],
];

/** 名字后跟可选的 `?` 再跟 `:` 时是属性名(JSON 的键, TS 的成员). */
const PROPERTY_FOLLOW = /\??\s*:/y;

function wordKind(word: string, previous: Token | undefined, language: CodeLanguage): TokenKind {
  if (LITERALS.has(word)) return "literal";
  if (language === "json") return "plain";
  if (KEYWORDS.has(word)) return "keyword";
  if (PRIMITIVE_TYPES.has(word)) return "type";
  if (previous?.kind === "keyword" && /^(interface|type|extends|enum|namespace)$/.test(previous.text)) return "type";
  return /^[A-Z]/.test(word) ? "type" : "plain";
}

/** JSDoc 块内的片段: 标签名, 以及标签所在行其后的字符串, 数字与字面量值. */
const DOC_PART = /(@[A-Za-z][\w-]*)|("(?:[^"\\\n]|\\.)*")|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?![\w.]))|\b(true|false|null|undefined)\b|(\n)/g;

/** 把 `/** ... *\/` 切成 comment 与 doctag, string, number, literal; 值只在同一行出现过标签之后才着色, 描述文字里的数字保持注释色. */
function docComment(text: string, push: (kind: TokenKind, text: string) => void): void {
  let index = 0;
  let afterTag = false;
  for (const match of text.matchAll(DOC_PART)) {
    const [part, tag, string, number, literal, newline] = match;
    if (newline !== undefined) {
      afterTag = false;
      continue;
    }
    const kind: TokenKind | undefined =
      tag !== undefined ? "doctag" : !afterTag ? undefined : string !== undefined ? "string" : number !== undefined ? "number" : literal !== undefined ? "literal" : undefined;
    if (tag !== undefined) afterTag = true;
    if (kind === undefined) continue;
    push("comment", text.slice(index, match.index));
    push(kind, part);
    index = match.index + part.length;
  }
  push("comment", text.slice(index));
}

export function highlight(code: string, language: CodeLanguage): Token[] {
  const tokens: Token[] = [];
  /** 最近一个非空白片段, 用于判断 interface 之后的类型名. */
  let previous: Token | undefined;
  const push = (kind: TokenKind, text: string) => {
    if (text === "") return;
    const last = tokens.at(-1);
    if (last !== undefined && last.kind === kind) last.text += text;
    else tokens.push({ kind, text });
    if (text.trim() !== "") previous = { kind, text };
  };
  let index = 0;
  while (index < code.length) {
    for (const [pattern, rule] of RULES) {
      pattern.lastIndex = index;
      const match = pattern.exec(code);
      if (match === null || match[0] === "") continue;
      const text = match[0];
      let kind: TokenKind = rule === "word" ? wordKind(text, previous, language) : rule;
      if (rule === "word" || rule === "string") {
        PROPERTY_FOLLOW.lastIndex = index + text.length;
        if (PROPERTY_FOLLOW.test(code) && (language === "json" ? rule === "string" : kind === "plain" || rule === "string")) kind = "property";
      }
      if (kind === "comment" && language === "typescript" && text.startsWith("/**")) docComment(text, push);
      else push(kind, text);
      index += text.length;
      break;
    }
  }
  return tokens;
}
