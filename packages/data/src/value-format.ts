// 日期组件的存储格式 x-valueFormat(方案 V2-V4): 校验取值, 按格式生成取值; dayjs 格式串, `x` `X` 时间戳与 4 个 RFC 3339 别名.
import dayjs, { type Dayjs } from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";
import { isTimestampValueFormat, isValueFormatAlias, matchesValueFormatText } from "@jotl/core";

dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

const RFC3339 =
	/^\d{4}-\d{2}-\d{2}[Tt](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

/** 别名读取时放宽: 任意合法 RFC 3339 date-time(带不带小数秒, Z 或 ±HH:mm); 日期部分另做严格检查, Date 会把 2 月 30 日顺延. */
export function isRfc3339DateTime(text: string): boolean {
	return (
		RFC3339.test(text) &&
		dayjs(text.slice(0, 10), "YYYY-MM-DD", true).isValid() &&
		dayjs(text).isValid()
	);
}

const OFFSET = /([+-])(\d{2}):?(\d{2})/;

/**
 * 严格解析. dayjs 严格模式会把结果按本地时区重新格式化再与原文比对, 带非本地偏移的值因此判为不合法;
 * 格式串含偏移记号 Z 时, 改按原文中的偏移重新格式化比对, 合法时返回该时刻(之后按本地时区显示).
 */
function strictParse(text: string, format: string): Dayjs | undefined {
	const d = dayjs(text, format, true);
	if (d.isValid()) return d;
	if (!/Z/.test(format.replace(/\[[^\]]*\]/g, ""))) return undefined;
	const loose = dayjs(text, format);
	const m = OFFSET.exec(text);
	if (!loose.isValid() || m === null) return undefined;
	const minutes = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
	return loose.utcOffset(minutes).format(format) === text ? loose : undefined;
}

/** 按格式串严格解析; 不合格式时返回 undefined. */
export function parseValueFormat(fmt: string, text: string): Dayjs | undefined {
	return strictParse(text, fmt);
}

// 校验格式串能否解析自身写出的值所用的时刻, 避开各地 DST 切换日.
const PROBE_MOMENT = "2024-01-17T14:05:09.123";
const roundTripCache = new Map<string, boolean>();

/**
 * 格式串能否往返: 按它写出固定时刻再严格解析回来. 含 dayjs 写不出(`w` `W` 等缺插件时抛异常)或解析不回(`k` `kk`,
 * 与其他记号混排的 `X` `x` 等)的记号时为 false; 这类格式串无法判定取值是否合法.
 */
function roundTrips(fmt: string): boolean {
	let result = roundTripCache.get(fmt);
	if (result === undefined) {
		try {
			result = strictParse(dayjs(PROBE_MOMENT).format(fmt), fmt) !== undefined;
		} catch {
			result = false;
		}
		roundTripCache.set(fmt, result);
	}
	return result;
}

/**
 * 取值是否符合存储格式; 类型不对(交给 type 关键字)时返回 true.
 * 格式串无法往返(编译期报 JOTL1053)时跳过校验返回 true: 无法判定时放行, 不误报合法取值.
 */
export function isValidValueFormatValue(fmt: string, data: unknown): boolean {
	if (isTimestampValueFormat(fmt)) return typeof data !== "number" || Number.isInteger(data);
	if (typeof data !== "string") return true;
	if (isValueFormatAlias(fmt)) return isRfc3339DateTime(data);
	// 优先用与时区无关的文本匹配; dayjs 严格解析在本地 DST 跳过的时刻(如纽约 2024-03-10 02:30)会误判不合法.
	const matched = matchesValueFormatText(fmt, data);
	if (matched !== undefined) return matched;
	if (!roundTrips(fmt)) return true;
	try {
		return parseValueFormat(fmt, data) !== undefined;
	} catch {
		return true;
	}
}

/** 按存储格式写出取值(方案 V3): 时间戳为整数, 其余为字符串. */
export function formatValueFormat(fmt: string, d: Dayjs): string | number {
	switch (fmt) {
		case "x":
			return d.valueOf();
		case "X":
			return Math.floor(d.valueOf() / 1000);
		case "iso":
			return d.format();
		case "iso-x": {
			const iso = d.format();
			return `${iso.slice(0, 19)}.${d.format("SSS")}${iso.slice(19)}`;
		}
		case "utc-x":
			return d.toISOString();
		case "utc":
			return d.toISOString().replace(/\.\d{3}Z$/, "Z");
		default:
			try {
				return d.format(fmt);
			} catch {
				// 含缺插件的记号(`w` `W` `gggg` `GGGG` `z`)时 dayjs 写出抛异常; 这类格式串不校验取值, 退回 RFC 3339.
				return d.format();
			}
	}
}

/** 默认数据用的固定时刻: 本地 2000-01-01 00:00:00. */
export function fixedMoment(): Dayjs {
	return dayjs("2000-01-01T00:00:00");
}

export { dayjs };
