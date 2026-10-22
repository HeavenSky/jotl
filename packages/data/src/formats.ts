// 覆盖 ajv-formats 中与 RFC 3339 / RFC 4122 / ECMA-262 不符的 format 实现, 使官方测试集 draft2020-12 的对应用例通过.
// @jotl/core 编译期的 FORMAT_CHECKS(syntax/value-check.ts)按同一规则检查 default, 改动时两边一起改.
import type { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatDefinition } from "ajv";
import addFormatsModule from "ajv-formats";

// ajv-formats 是 CJS 包, NodeNext 下默认导入得到的是模块对象.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isDate(text: string): boolean {
	const m = DATE.exec(text);
	if (m === null) return false;
	const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	return (
		month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && leap ? 29 : DAYS[month]!)
	);
}

// 偏移必须是 Z 或 ±HH:mm; 小数秒只取整数部分比较, 避免 59.999999999999999 按浮点数进位成 60.
const TIME = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:z|([+-])(\d{2}):(\d{2}))$/i;

/** RFC 3339 full-time; 秒为 60(闰秒)时换算到 UTC 须为 23:59. */
function isTime(text: string): boolean {
	const m = TIME.exec(text);
	if (m === null) return false;
	const [hour, minute, second] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (hour > 23 || minute > 59 || second > 60) return false;
	let offset = 0;
	if (m[4] !== undefined) {
		const [offsetHour, offsetMinute] = [Number(m[5]), Number(m[6])];
		if (offsetHour > 23 || offsetMinute > 59) return false;
		offset = (m[4] === "-" ? -1 : 1) * (offsetHour * 60 + offsetMinute);
	}
	if (second < 60) return true;
	return (((hour * 60 + minute - offset) % 1440) + 1440) % 1440 === 23 * 60 + 59;
}

/** RFC 3339 date-time; 与 ajv-formats 一样允许以空格分隔日期与时间. */
function isDateTime(text: string): boolean {
	const parts = text.split(/t|\s/i);
	return parts.length === 2 && isDate(parts[0]!) && isTime(parts[1]!);
}

// RFC 3339 附录 A: 年后只能接月, 月后只能接日; 时后只能接分, 分后只能接秒; 周不能与其他单位组合.
const DURATION =
	/^P(?!$)(?:(?:\d+D|\d+M(?:\d+D)?|\d+Y(?:\d+M(?:\d+D)?)?)?(?:T(?=\d)(?:\d+H(?:\d+M(?:\d+S)?)?|\d+M(?:\d+S)?|\d+S))?|\d+W)$/;

// RFC 4122 的字符串形式, 不接受 urn:uuid: 前缀.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ECMA-262 正则: 按 u 标志编译, 拒绝 `\a` 这类非 u 模式下才放行的身份转义. */
function isRegex(text: string): boolean {
	try {
		new RegExp(text, "u");
		return true;
	} catch {
		return false;
	}
}

const hostnamePattern = addFormats.get("hostname") as RegExp;

/** 在 ajv-formats 之上覆盖; 保留各 format 原有的 compare, formatMinimum 等关键字照常可用. */
export function addStrictFormats(ajv: Ajv2020): void {
	const withCompare = (name: "time" | "date-time", validate: (text: string) => boolean) => {
		const { compare } = addFormats.get(name) as FormatDefinition<string>;
		ajv.addFormat(name, compare ? { type: "string", validate, compare } : validate);
	};
	withCompare("time", isTime);
	withCompare("date-time", isDateTime);
	ajv.addFormat("duration", DURATION);
	ajv.addFormat("uuid", UUID);
	ajv.addFormat("regex", isRegex);
	// RFC 1123 主机名不含末尾的点(那是 FQDN 的写法).
	ajv.addFormat("hostname", (text: string) => !text.endsWith(".") && hostnamePattern.test(text));
}
