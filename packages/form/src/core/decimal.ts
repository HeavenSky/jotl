// 精确十进制: 数值与 money / bigint 值对象和 Big 互转, 千分位的显示与去除; 千分位只按字符串处理, 不经过 Number 与 Intl.
import Big from "big.js";

/** 精确数字符串: 只禁止指数, 千分位与空白. */
export const EXACT_DECIMAL = /^-?\d+(\.\d+)?$/;

/** money / bigint 的值对象. */
export interface DecimalValue {
  type: "money" | "bigint";
  value: string;
  [key: string]: unknown;
}

export function isDecimalValue(x: unknown): x is DecimalValue {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const v = x as Record<string, unknown>;
  return (v.type === "money" || v.type === "bigint") && typeof v.value === "string";
}

/** 数值, 精确数字符串, 或 money / bigint 值对象转为 Big; 不合法时抛错(同 big.js). */
export function toBig(x: number | string | DecimalValue): Big {
  if (typeof x === "number" || typeof x === "string") return new Big(x);
  if (isDecimalValue(x)) return new Big(x.value);
  throw new TypeError("toBig: 不支持的值");
}

/**
 * 按 template 的形态写回: 值对象保留 type 以外的字段(currency unit 等)并替换 value, bigint 向零取整;
 * 数值返回 number, 字符串返回精确数字符串. decimals 给出时按它定长(四舍五入), 否则沿用 template 字符串的小数位数.
 */
export function fromBig<T extends number | string | DecimalValue>(b: Big, template: T, decimals?: number): T {
  if (typeof template === "number") return b.toNumber() as T;
  const text = typeof template === "string" ? template : template.value;
  if (typeof template === "object" && template.type === "bigint") {
    return { ...template, value: normalizeZero(b.round(0, Big.roundDown).toFixed(0)) };
  }
  const dot = text.indexOf(".");
  const places = decimals ?? (dot === -1 ? 0 : text.length - dot - 1);
  const value = normalizeZero(b.toFixed(places));
  return (typeof template === "string" ? value : { ...(template as DecimalValue), value }) as T;
}

/** big.js 对负零给出 "-0" / "-0.00", 存储值统一为非负零. */
function normalizeZero(text: string): string {
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

/** 去掉键入或粘贴时的千分位与空白: 半角与全角逗号, 空白, 下划线. */
export function stripThousands(text: string): string {
  return text.replace(/[,，\s_]/g, "");
}

/** 只对字符串的整数部分每 3 位插入 ","; 不是精确数字符串时原样返回. */
export function formatThousands(text: string): string {
  if (!EXACT_DECIMAL.test(text)) return text;
  const sign = text.startsWith("-") ? "-" : "";
  const body = sign === "" ? text : text.slice(1);
  const dot = body.indexOf(".");
  const integer = dot === -1 ? body : body.slice(0, dot);
  const fraction = dot === -1 ? "" : body.slice(dot);
  return `${sign}${integer.replace(/\B(?=(\d{3})+$)/g, ",")}${fraction}`;
}
