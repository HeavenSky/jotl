// JSDoc 标签取值的编码与解码(README "标签协议" 的取值编码): 文本转义, JSON 取值, 正则与示例的写法.

/** TSDoc 会当作语法的字符; 文本中出现时用反斜杠转义. */
const TSDOC_SPECIAL = /[\\@{}<>`]/g;
/** TSDoc 只允许反斜杠转义 ASCII 标点. */
const TSDOC_ESCAPE = /\\([!-/:-@[-`{-~])/g;

/** 文本写入注释: 转义 TSDoc 语法字符, `*\/` 防止提前结束注释. */
export function encodeText(text: string): string {
  return text.replace(TSDOC_SPECIAL, "\\$&").replace(/\*\//g, "*\\/");
}

export function decodeText(text: string): string {
  return text.replace(TSDOC_ESCAPE, "$1");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 写入注释的 JSON 文本; 反引号与 `*\/` 只可能出现在字符串内, 改写为等价的 JSON 转义. */
function safeJson(value: unknown, indent?: number): string {
  return JSON.stringify(value, null, indent).replace(/`/g, "\\u0060").replace(/\*\//g, "*\\/");
}

/** JSON 语义的标签值: 对象, 以及含 TSDoc 语法字符或反斜杠的值用反引号包裹. */
export function encodeJson(value: unknown): string {
  const json = safeJson(value);
  return isPlainObject(value) || /[\\@{}<>]/.test(json) ? `\`${json}\`` : json;
}

/** 示例: 对象与含对象的数组写成 json 代码块, 其余同 `encodeJson`. */
export function encodeExample(value: unknown): string[] {
  const hasObject = isPlainObject(value) || (Array.isArray(value) && value.some((v) => typeof v === "object" && v !== null));
  if (!hasObject) return [encodeJson(value)];
  return ["```json", ...safeJson(value, 2).split("\n"), "```"];
}

/** 正则: 一般写在反引号中; 无法原样放入的(含反引号, 含 `*\/`, 以引号开头)改写为反引号中的 JSON 字符串. */
export function encodePattern(pattern: string): string {
  const needsJson = /[`\n\r]|\*\\?\//.test(pattern) || pattern.startsWith("\"") || pattern.trim() !== pattern
    || pattern === "";
  return needsJson ? `\`${safeJson(pattern)}\`` : `\`${pattern}\``;
}

function stripTicks(text: string): string | undefined {
  return text.length >= 2 && text.startsWith("`") && text.endsWith("`") && !text.slice(1, -1).includes("`")
    ? text.slice(1, -1)
    : undefined;
}

export function decodePattern(text: string): string {
  // 不在反引号中的正则不做 TSDoc 反转义: `\.` 这类写法在正则中有含义.
  const inner = stripTicks(text) ?? text;
  if (inner.startsWith("\"")) {
    try {
      const value: unknown = JSON.parse(inner);
      if (typeof value === "string") return value;
    } catch {
      // 不是 JSON 字符串时按原文处理.
    }
  }
  return inner.replace(/\*\\\//g, "*/");
}

export type DecodedJson = { ok: true; value: unknown } | { ok: false; text: string };

/** 先按 JSON 解析, 失败时返回去掉转义的原文, 由调用方按字符串处理并告警. */
export function decodeJson(text: string): DecodedJson {
  const inner = stripTicks(text);
  const candidates = inner === undefined ? [text, decodeText(text)] : [inner];
  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown };
    } catch {
      // 继续尝试下一种写法.
    }
  }
  return { ok: false, text: inner ?? decodeText(text) };
}

/** 示例: 含代码块时取第一个代码块的内容. */
export function decodeExample(text: string): DecodedJson {
  const fence = /```[^\n]*\n([\s\S]*?)\n?```/.exec(text);
  return decodeJson(fence?.[1] ?? text);
}

export function decodeTextTag(text: string): string {
  return stripTicks(text) ?? decodeText(text);
}
