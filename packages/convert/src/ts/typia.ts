// typia 类型标签输出(README "typia 类型标签")用到的取值表与 JSON 值到 TS 字面量类型的转换.

/** `tags.Format` 接受的格式; 必须与 typia@15.1.0 的 `Format.Value` 一致, 多写会产生类型错误. */
export const TYPIA_FORMATS: ReadonlySet<string> = new Set([
  "byte", "password", "regex", "uuid", "email", "hostname", "idn-email", "idn-hostname", "iri", "iri-reference",
  "ipv4", "ipv6", "uri", "uri-reference", "uri-template", "url", "date-time", "date", "time", "duration",
  "json-pointer", "relative-json-pointer",
]);

/** JSON 值写成 TS 字面量类型: 数组为元组, 对象为类型字面量. */
export function renderTypeLiteral(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(renderTypeLiteral).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${renderTypeLiteral(v)}`).join("; ")} }`;
  }
  return "unknown";
}
