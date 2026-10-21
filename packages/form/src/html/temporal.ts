// 日期组件的存储格式(x-valueFormat)与原生 date / time / datetime-local 控件值之间的换算, 按本地时区; 别名的写法见方案 V3.
import dayjs, { type Dayjs } from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";
import {
	DEFAULT_VALUE_FORMATS,
	type JsonSchemaObject,
	type TemporalComponent,
	isTimestampValueFormat,
	isValueFormatAlias,
} from "@jotl/core";

dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

export type TemporalKind = TemporalComponent;

const RFC3339 =
	/^\d{4}-\d{2}-\d{2}[Tt](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

/** 节点的存储格式: `x-valueFormat`, 否则取组件默认(与 `format: date` / `date-time` 一致). */
export function storageFormat(schema: JsonSchemaObject, kind: TemporalKind): string {
	const vf = schema["x-valueFormat"];
	return typeof vf === "string" && vf !== "" ? vf : DEFAULT_VALUE_FORMATS[kind];
}

export function isTimestampFormat(format: string): boolean {
	return isTimestampValueFormat(format);
}

/** 别名读取放宽为任意 RFC 3339 date-time; 日期部分另做严格检查, Date 会把 2 月 30 日顺延. */
function parseRfc3339(text: string): Dayjs | undefined {
	if (!RFC3339.test(text) || !dayjs(text.slice(0, 10), "YYYY-MM-DD", true).isValid())
		return undefined;
	const d = dayjs(text);
	return d.isValid() ? d : undefined;
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

function parseStrict(text: string, format: string): Dayjs | undefined {
	return strictParse(text, format);
}

/** 存储值 → 时刻; 不符合存储格式时返回 undefined. 时间戳只认整数. */
export function parseStored(value: unknown, format: string): Dayjs | undefined {
	if (isTimestampFormat(format)) {
		if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
		const d = format === "x" ? dayjs(value) : dayjs.unix(value);
		return d.isValid() ? d.local() : undefined;
	}
	if (typeof value !== "string") return undefined;
	if (isValueFormatAlias(format)) return parseRfc3339(value)?.local();
	return parseStrict(value, format)?.local();
}

/** 时刻 → 存储值(本地时区). */
export function formatStored(d: Dayjs, format: string): string | number {
	switch (format) {
		case "x":
			return d.valueOf();
		case "X":
			return d.unix();
		case "iso":
			return d.format();
		case "iso-x": {
			const iso = d.format();
			// format() 的偏移总是 ±HH:mm 六个字符.
			return `${iso.slice(0, -6)}.${d.format("SSS")}${iso.slice(-6)}`;
		}
		case "utc-x":
			return d.toISOString();
		case "utc":
			return d.toISOString().replace(/\.\d{3}Z$/, "Z");
		default:
			return d.format(format);
	}
}

/** 原生控件的精度: 自定义格式含毫秒(SSS)时到毫秒, 含秒(ss)时到秒; 别名与时间戳到秒; 否则不定(按值显示). */
export type ControlPrecision = "milli" | "second" | undefined;

export function controlPrecision(format: string): ControlPrecision {
	if (isTimestampFormat(format) || isValueFormatAlias(format)) return "second";
	const tokens = format.replace(/\[[^\]]*\]/g, "");
	if (/S/.test(tokens)) return "milli";
	if (/s/.test(tokens)) return "second";
	return undefined;
}

/** 原生控件的 step: 到毫秒为 0.001, 到秒为 1. */
export function controlStep(precision: ControlPrecision): number | undefined {
	return precision === "milli" ? 0.001 : precision === "second" ? 1 : undefined;
}

/** 时刻 → 原生控件值; 精度不定时秒为零只到分钟, 原生控件据此不显示秒. */
export function toControl(d: Dayjs, kind: TemporalKind, precision?: ControlPrecision): string {
	if (kind === "date") return d.format("YYYY-MM-DD");
	const time =
		precision === "milli"
			? "HH:mm:ss.SSS"
			: precision === "second" || d.second() !== 0
				? "HH:mm:ss"
				: "HH:mm";
	return d.format(kind === "time" ? time : `YYYY-MM-DD[T]${time}`);
}

const CONTROL_FORMATS: Readonly<Record<TemporalKind, string[]>> = {
	date: ["YYYY-MM-DD"],
	time: ["HH:mm", "HH:mm:ss"],
	datetime: ["YYYY-MM-DDTHH:mm", "YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DDTHH:mm:ss.SSS"],
};

/** 原生控件值 → 本地时刻: date 为当天零点, time 为今天的该时刻; 小数秒补足三位; 无法识别时返回 undefined. */
export function fromControl(
	control: string,
	kind: TemporalKind,
	now: Dayjs = dayjs()
): Dayjs | undefined {
	const padded = control.replace(/\.(\d{1,3})$/, (_, ms: string) => `.${ms.padEnd(3, "0")}`);
	const text = kind === "time" ? `${now.format("YYYY-MM-DD")}T${padded}` : padded;
	const formats = kind === "time" ? CONTROL_FORMATS.datetime : CONTROL_FORMATS[kind];
	for (const format of formats) {
		const d = dayjs(text, format, true);
		if (d.isValid()) return d;
	}
	return undefined;
}

/** 文本框中键入的文本 → 规范化的存储值; 时间戳格式下文本为整数. 无法按存储格式解析时返回 undefined. */
export function textToStored(text: string, format: string): string | number | undefined {
	const value = isTimestampFormat(format)
		? /^-?\d+$/.test(text.trim())
			? Number(text.trim())
			: undefined
		: text;
	const d = value === undefined ? undefined : parseStored(value, format);
	return d === undefined ? undefined : formatStored(d, format);
}
