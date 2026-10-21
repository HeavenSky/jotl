import dayjs from "dayjs";
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
		expect(DEFAULT_VALUE_FORMATS).toEqual({
			date: "YYYY-MM-DD",
			time: "HH:mm:ss",
			datetime: "iso",
		});
	});

	it.each([
		["x", "datetime"],
		["utc", "datetime"],
		["YYYY-MM-DD HH:mm", "datetime"],
		["HH:mm", "time"],
		["YYYYMMDD", "date"],
		["[at] HH", "time"],
		["[Hms] YYYY", "date"],
	] as const)("%s → %s", (format, component) =>
		expect(valueFormatComponent(format)).toBe(component)
	);
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
		["M/D/YYYY", "1/2/2026", true],
		["M/D/YYYY", "01/2/2026", false],
		["M/D/YYYY", "2/30/2026", false],
		["YY-MM-DD", "24-02-29", true],
		["YY-MM-DD", "23-02-29", false],
		["YYYY YY", "2026 26", true],
		["YYYY YY", "2026 25", false],
		["H:m:s", "0:5:9", true],
		["H:m:s", "00:05:09", false],
		["H:m:s", "24:0:0", false],
		["h:mm A", "1:30 PM", true],
		["hh:mm a", "12:00 am", true],
		["hh:mm a", "00:00 am", false],
		["hh:mm", "01:00", true],
		["h:mm", "13:00", false],
		["HH hh A", "13 01 PM", true],
		["HH hh A", "13 01 AM", false],
		["HH hh", "00 12", true],
		["HH hh", "13 02", false],
		["A", "PM", true],
	] as const)("%s %j → %s", (format, text, valid) =>
		expect(matchesValueFormatText(format, text)).toBe(valid)
	);

	it("含不支持的记号时无法判定", () => {
		for (const format of [
			"MMM D, YYYY",
			"MMMM",
			"Do MMM",
			"dd HH:mm",
			"ddd",
			"dddd",
			"YYYY-MM-DD X",
			"x HH",
		]) {
			expect(matchesValueFormatText(format, "anything")).toBeUndefined();
		}
		expect(matchesValueFormat("MMM D, YYYY", "anything")).toBe(true);
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

describe("与 dayjs format 往返", () => {
	const formats = [
		"YYYY-MM-DD",
		"YY/M/D",
		"M/D/YYYY H:m:s",
		"YYYY-MM-DD HH:mm:ss.SSS",
		"h:mm A",
		"hh:mm:ss a",
		"YYYY-MM-DD hh:mm A HH H h",
		"[Day] D, YYYY h a",
		"YYYY-MM-DDTHH:mm:ssZ",
		"YYYYMMDDHHmmssZZ",
	];
	const moments = [
		"2000-01-01T00:00:00",
		"2024-02-29T12:00:00",
		"1999-12-31T23:59:59.999",
		"2026-10-05T09:05:07.010",
		"2068-06-30T11:59:00",
		"1969-07-20T20:17:40",
	].map(t => dayjs(t));
	it.each(formats)("%s", format => {
		for (const d of moments)
			expect([d.toISOString(), matchesValueFormatText(format, d.format(format))]).toEqual([
				d.toISOString(),
				true,
			]);
	});
});
