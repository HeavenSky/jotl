// 日期组件的存储格式 x-valueFormat 的公共规则: 别名, 时间戳, 组件推断, 各组件默认格式, 以及不依赖 dayjs 的取值校验.

export type TemporalComponent = "date" | "time" | "datetime";

/** 日期组件 → 默认的 `value_format`(存储格式). */
export const DEFAULT_VALUE_FORMATS: Readonly<Record<TemporalComponent, string>> = {
  date: "YYYY-MM-DD",
  time: "HH:mm:ss",
  datetime: "iso",
};

/** RFC 3339 日期时间的别名; 读取时放宽为任意 RFC 3339 date-time, 写回时按别名统一. */
export const VALUE_FORMAT_ALIASES: readonly string[] = ["iso", "iso-x", "utc", "utc-x"];

/** 毫秒 / 秒时间戳, 值为整数. */
export const TIMESTAMP_VALUE_FORMATS: readonly string[] = ["x", "X"];

export function isValueFormatAlias(format: string): boolean {
  return VALUE_FORMAT_ALIASES.includes(format);
}

export function isTimestampValueFormat(format: string): boolean {
  return TIMESTAMP_VALUE_FORMATS.includes(format);
}

/** 按格式内容推断组件(无 `x-ui.widget` 时): 同时有日期与时间记号为 datetime, 只有时间为 time, 其余为 date; 时间戳与别名为 datetime. */
export function valueFormatComponent(format: string): TemporalComponent {
  if (isTimestampValueFormat(format) || isValueFormatAlias(format)) return "datetime";
  const tokens = format.replace(/\[[^\]]*\]/g, "");
  const date = /[YMD]/.test(tokens);
  const time = /[Hhms]/.test(tokens);
  if (date && time) return "datetime";
  return time ? "time" : "date";
}

function daysInMonth(year: number | undefined, month: number | undefined): number {
  if (month === undefined) return 31;
  if (month !== 2) return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return year === undefined || (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
}

const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})[Tt](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

/** 任意合法 RFC 3339 date-time(带不带小数秒, Z 或 ±HH:mm), 日期按日历检查. */
export function isRfc3339DateTime(text: string): boolean {
  const m = RFC3339.exec(text);
  if (m === null) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

// dayjs format 的记号; 只支持下表中的记号, 其余记号的格式串不校验.
const FORMAT_TOKENS = /\[([^\]]*)\]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS|Do|Q|w{1,2}|W{1,2}|k{1,2}|X|x|z{1,2}|S{1,2}/g;

type Field = "year" | "month" | "day" | "hour" | "minute" | "second" | "milli" | "offset" | "meridiem";

const TOKEN_PATTERNS: Readonly<Record<string, [string, Field]>> = {
  YYYY: ["\\d{4}", "year"],
  MM: ["0[1-9]|1[0-2]", "month"],
  DD: ["0[1-9]|[12]\\d|3[01]", "day"],
  HH: ["[01]\\d|2[0-3]", "hour"],
  mm: ["[0-5]\\d", "minute"],
  ss: ["[0-5]\\d", "second"],
  SSS: ["\\d{3}", "milli"],
  Z: ["[+-](?:[01]\\d|2[0-3]):[0-5]\\d", "offset"],
  ZZ: ["[+-](?:[01]\\d|2[0-3])[0-5]\\d", "offset"],
  A: ["AM|PM", "meridiem"],
  a: ["am|pm", "meridiem"],
};

interface CompiledFormat {
  re: RegExp;
  fields: Field[];
}

const compiled = new Map<string, CompiledFormat | undefined>();

function compileFormat(format: string): CompiledFormat | undefined {
  if (compiled.has(format)) return compiled.get(format);
  let source = "";
  const fields: Field[] = [];
  let last = 0;
  let supported = true;
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const m of format.matchAll(FORMAT_TOKENS)) {
    source += escapeRegExp(format.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined) {
      source += escapeRegExp(m[1]);
      continue;
    }
    const pattern = TOKEN_PATTERNS[m[0]];
    if (pattern === undefined) {
      supported = false;
      break;
    }
    source += `(${pattern[0]})`;
    fields.push(pattern[1]);
  }
  source += escapeRegExp(format.slice(last));
  const result = supported ? { re: new RegExp(`^${source}$`), fields } : undefined;
  compiled.set(format, result);
  return result;
}

/**
 * 按 dayjs 格式串严格匹配文本: 逐位匹配记号并校验日历日期, 同一字段多次出现须一致, `A` `a` 须与 `HH` 的上下午一致.
 * 只支持 `YYYY MM DD HH mm ss SSS Z ZZ A a` 与 `[..]` 转义; 含其他记号时返回 undefined(无法判定).
 */
export function matchesValueFormatText(format: string, text: string): boolean | undefined {
  const c = compileFormat(format);
  if (c === undefined) return undefined;
  const m = c.re.exec(text);
  if (m === null) return false;
  const values: Partial<Record<Field, string>> = {};
  for (let i = 0; i < c.fields.length; i++) {
    const field = c.fields[i]!;
    const value = field === "offset" ? m[i + 1]!.replace(":", "") : field === "meridiem" ? m[i + 1]!.toUpperCase() : m[i + 1]!;
    if (values[field] !== undefined && values[field] !== value) return false;
    values[field] = value;
  }
  const num = (field: Field) => (values[field] === undefined ? undefined : Number(values[field]));
  const day = num("day");
  if (day !== undefined && day > daysInMonth(num("year"), num("month"))) return false;
  if (values.meridiem !== undefined && values.meridiem !== ((num("hour") ?? 0) >= 12 ? "PM" : "AM")) return false;
  return true;
}

/**
 * 取值是否符合存储格式, 与 `@jotl/data` 运行期校验的结论一致: 时间戳只验整数, 别名按 RFC 3339, 其余按格式串严格匹配;
 * 类型不对(交给 type 关键字)或格式串含不支持的记号时返回 true.
 */
export function matchesValueFormat(format: string, value: unknown): boolean {
  if (isTimestampValueFormat(format)) return typeof value !== "number" || Number.isInteger(value);
  if (typeof value !== "string") return true;
  if (isValueFormatAlias(format)) return isRfc3339DateTime(value);
  return matchesValueFormatText(format, value) ?? true;
}
