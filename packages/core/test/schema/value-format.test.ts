import { describe, expect, it } from "vitest";
import {
  DEFAULT_VALUE_FORMATS,
  isRfc3339DateTime,
  isTimestampValueFormat,
  isValueFormatAlias,
  matchesValueFormat,
  matchesValueFormatText,
  valueFormatComponent,
} from "../../src/schema/index.js";

describe("别名, 时间戳与组件推断", () => {
  it("别名与时间戳", () => {
    expect(["iso", "iso-x", "utc", "utc-x"].every(isValueFormatAlias)).toBe(true);
    expect(isValueFormatAlias("ISO")).toBe(false);
    expect(isTimestampValueFormat("x") && isTimestampValueFormat("X")).toBe(true);
    expect(isTimestampValueFormat("xx")).toBe(false);
    expect(DEFAULT_VALUE_FORMATS).toEqual({ date: "YYYY-MM-DD", time: "HH:mm:ss", datetime: "iso" });
  });

  it.each([
    ["x", "datetime"],
    ["utc", "datetime"],
    ["YYYY-MM-DD HH:mm", "datetime"],
    ["HH:mm", "time"],
    ["YYYYMMDD", "date"],
    ["[at] HH", "time"],
    ["[Hms] YYYY", "date"],
  ] as const)("%s → %s", (format, component) => expect(valueFormatComponent(format)).toBe(component));
});

describe("matchesValueFormatText", () => {
  it.each([
    ["YYYY-MM-DD", "2024-02-29", true],
    ["YYYY-MM-DD", "2023-02-29", false],
    ["YYYY-MM-DD", "2026-04-31", false],
    ["YYYY-MM-DD", "2026-4-03", false],
    ["YYYYMMDD", "20261013", true],
    ["HH:mm:ss.SSS", "23:59:59.999", true],
    ["HH:mm:ss", "24:00:00", false],
    ["HH:mm:ssZ", "10:00:00+08:00", true],
    ["HH:mm:ssZ", "10:00:00Z", false],
    ["HH:mm:ssZZ", "10:00:00-0530", true],
    ["HH:mm:ssZZ", "10:00:00-05:30", false],
    ["HH:mm A", "13:00 PM", true],
    ["HH:mm A", "01:00 PM", false],
    ["HH:mm a", "09:00 am", true],
    ["[Day] YYYY.MM", "Day 2026.10", true],
    ["[Day] YYYY.MM", "Day 2026-10", false],
    ["YYYY-MM-DDTHH:mm", "2026-10-13T09:30", true],
    ["YYYY YYYY", "2026 2027", false],
  ] as const)("%s %j → %s", (format, text, valid) => expect(matchesValueFormatText(format, text)).toBe(valid));

  it("含不支持的记号时无法判定", () => {
    expect(matchesValueFormatText("M/D/YYYY", "1/2/2026")).toBeUndefined();
    expect(matchesValueFormatText("hh:mm", "01:00")).toBeUndefined();
    expect(matchesValueFormat("M/D/YYYY", "anything")).toBe(true);
  });
});

describe("matchesValueFormat", () => {
  it("时间戳只验整数, 别名按 RFC 3339, 类型不对时交给 type", () => {
    expect(matchesValueFormat("x", 1791855015000)).toBe(true);
    expect(matchesValueFormat("X", 1.5)).toBe(false);
    expect(matchesValueFormat("x", "1")).toBe(true);
    expect(matchesValueFormat("utc", "2026-10-13T09:30:15.5+08:00")).toBe(true);
    expect(matchesValueFormat("iso", "2026-02-30T09:30:15Z")).toBe(false);
    expect(matchesValueFormat("YYYY", 2026)).toBe(true);
    expect(isRfc3339DateTime("2026-10-13 09:30:15Z")).toBe(false);
  });
});
