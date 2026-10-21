import dayjs from "dayjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	controlPrecision,
	formatStored,
	fromControl,
	parseStored,
	storageFormat,
	textToStored,
	toControl,
} from "../../src/html/temporal.js";

const originalTz = process.env.TZ;
beforeAll(() => {
	process.env.TZ = "Asia/Shanghai";
});
afterAll(() => {
	if (originalTz === undefined) delete process.env.TZ;
	else process.env.TZ = originalTz;
});

/** 北京时间 2026-10-13 09:30:15. */
const moment = () => dayjs("2026-10-13T09:30:15");

describe("storageFormat", () => {
	it("x-valueFormat 优先, 否则取组件默认", () => {
		expect(storageFormat({ type: "string", "x-valueFormat": "YYYYMMDD" }, "date")).toBe(
			"YYYYMMDD"
		);
		expect(
			storageFormat(
				{ type: "string", format: "date-time", "x-valueFormat": "utc" },
				"datetime"
			)
		).toBe("utc");
		expect(storageFormat({ type: "string", format: "date" }, "date")).toBe("YYYY-MM-DD");
		expect(storageFormat({ type: "string", format: "date-time" }, "datetime")).toBe("iso");
		expect(storageFormat({ type: "string" }, "time")).toBe("HH:mm:ss");
	});
});

describe("formatStored: 别名按方案 V3, 时间戳为整数", () => {
	it.each([
		["iso", "2026-10-13T09:30:15+08:00"],
		["iso-x", "2026-10-13T09:30:15.000+08:00"],
		["utc", "2026-10-13T01:30:15Z"],
		["utc-x", "2026-10-13T01:30:15.000Z"],
		["x", 1791855015000],
		["X", 1791855015],
		["YYYYMMDD", "20261013"],
		["HH:mm", "09:30"],
		["HH:mm:ssZ", "09:30:15+08:00"],
	])("%s → %s", (format, expected) => expect(formatStored(moment(), format)).toBe(expected));
});

describe("parseStored", () => {
	it("别名放宽为任意 RFC 3339 date-time", () => {
		for (const format of ["iso", "iso-x", "utc", "utc-x"]) {
			for (const text of [
				"2026-10-13T01:30:15Z",
				"2026-10-13T01:30:15.000Z",
				"2026-10-13T09:30:15+08:00",
				"2026-10-12T20:30:15.5-05:00",
			]) {
				expect(parseStored(text, format)?.second(), `${format} ${text}`).toBe(15);
				expect(toControl(parseStored(text, format)!, "datetime")).toBe(
					"2026-10-13T09:30:15"
				);
			}
			expect(parseStored("2026-10-13 09:30", format)).toBeUndefined();
			expect(parseStored("2026-10-13T09:30:15", format)).toBeUndefined();
			expect(parseStored("2026-02-30T09:30:15Z", format)).toBeUndefined();
		}
	});

	it("时间戳只认整数", () => {
		expect(parseStored(1791855015000, "x")?.valueOf()).toBe(1791855015000);
		expect(parseStored(1791855015, "X")?.valueOf()).toBe(1791855015000);
		expect(parseStored("1791855015000", "x")).toBeUndefined();
		expect(parseStored(1.5, "x")).toBeUndefined();
	});

	it("其余格式严格解析", () => {
		expect(parseStored("20261013", "YYYYMMDD")?.format("YYYY-MM-DD")).toBe("2026-10-13");
		expect(parseStored("2026-10-13", "YYYYMMDD")).toBeUndefined();
		expect(parseStored("20261332", "YYYYMMDD")).toBeUndefined();
		expect(parseStored("09:30:15", "HH:mm")).toBeUndefined();
		expect(toControl(parseStored("10:00:00+08:00", "HH:mm:ssZ")!, "time")).toBe("10:00");
		expect(parseStored("十点", "HH:mm:ss")).toBeUndefined();
		// 带非本地偏移的值按原文偏移解析为同一时刻, 之后按本地时区显示.
		expect(parseStored("2026-10-13 01:30:15+00:00", "YYYY-MM-DD HH:mm:ssZ")?.valueOf()).toBe(
			Date.parse("2026-10-13T01:30:15Z")
		);
		expect(parseStored("2026-10-13 09:30:15-05:00", "YYYY-MM-DD HH:mm:ssZ")?.valueOf()).toBe(
			Date.parse("2026-10-13T14:30:15Z")
		);
	});
});

describe("控件值", () => {
	it("toControl: 秒为零时只到分钟", () => {
		expect(toControl(moment(), "date")).toBe("2026-10-13");
		expect(toControl(moment(), "time")).toBe("09:30:15");
		expect(toControl(dayjs("2026-10-13T09:30:00"), "datetime")).toBe("2026-10-13T09:30");
	});

	it("controlPrecision: 自定义格式按 SSS / ss 取精度, 别名与时间戳到秒", () => {
		expect(controlPrecision("HH:mm:ss.SSS")).toBe("milli");
		expect(controlPrecision("HH:mm:ss")).toBe("second");
		expect(controlPrecision("HH:mm")).toBeUndefined();
		expect(controlPrecision("HH:mm[ss]")).toBeUndefined();
		expect(controlPrecision("iso-x")).toBe("second");
		expect(controlPrecision("x")).toBe("second");
	});

	it("toControl 按精度补秒与毫秒; fromControl 认小数秒", () => {
		expect(toControl(dayjs("2026-10-13T09:30:00"), "time", "second")).toBe("09:30:00");
		expect(toControl(dayjs("2026-10-13T09:30:15.123"), "datetime", "milli")).toBe(
			"2026-10-13T09:30:15.123"
		);
		expect(fromControl("09:30:15.1", "time", moment())!.format("HH:mm:ss.SSS")).toBe(
			"09:30:15.100"
		);
		expect(fromControl("2026-10-13T09:30:15.123", "datetime")!.format("HH:mm:ss.SSS")).toBe(
			"09:30:15.123"
		);
	});

	it("fromControl: date 为当天本地零点, time 为今天的该时刻", () => {
		expect(formatStored(fromControl("2026-10-13", "date")!, "x")).toBe(
			dayjs("2026-10-13T00:00:00+08:00").valueOf()
		);
		expect(fromControl("09:30", "time", moment())!.format()).toBe("2026-10-13T09:30:00+08:00");
		expect(fromControl("2026-10-13T09:30:15", "datetime")!.format()).toBe(
			"2026-10-13T09:30:15+08:00"
		);
		expect(fromControl("abc", "datetime")).toBeUndefined();
	});

	it("textToStored 按存储格式解析并规范化", () => {
		expect(textToStored("20261013", "YYYYMMDD")).toBe("20261013");
		expect(textToStored("2026-10-13T01:30:15.5Z", "utc")).toBe("2026-10-13T01:30:15Z");
		expect(textToStored("1791855015", "X")).toBe(1791855015);
		expect(textToStored("abc", "X")).toBeUndefined();
		expect(textToStored("2026/10/13", "YYYYMMDD")).toBeUndefined();
	});
});
