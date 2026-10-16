// 任意 JSON 值的单行显示文本: 字符串取原文, 其余取 JSON 文本.
export function formatValue(value: unknown): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}
