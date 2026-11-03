// 显示条件(D43)求值: eq ne 按 JSON 值深度相等, in notIn 按 right 数组, truthy 按 right 布尔, gt gte lt lte 比较数值;
// left 为从数据根或当前节点所在对象(base: "node")起算的 lodash get 路径, "*" 取当前节点实际路径中同一位置的片段.
import {
	POINTER_WILDCARD,
	type Condition,
	type JsonPointer,
	formatPointer,
	lookupPointer,
	parseLodashPath,
	tryParsePointer,
} from "@jotl/core";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON 值的深度相等: 对象比较键集合与各键的值, 数组按位置比较. */
export function jsonEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a)) {
		return (
			Array.isArray(b) && a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]))
		);
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = Object.keys(a);
		if (keys.length !== Object.keys(b).length) return false;
		return keys.every(key => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]));
	}
	return false;
}

/**
 * 取 left 指向的值; 路径不合法或找不到(含 "*" 位置超出 dataPath)时返回 undefined.
 * base 为 "node" 时 left 从当前节点所在的对象(dataPath 的父路径)起算, "*" 按拼接后的绝对位置取 dataPath 中的片段.
 */
function readField(left: unknown, base: unknown, data: unknown, dataPath: JsonPointer): unknown {
	if (typeof left !== "string") return undefined;
	const relative = parseLodashPath(left);
	const pathTokens = tryParsePointer(dataPath) ?? [];
	if (relative === undefined) return undefined;
	const tokens = base === "node" ? [...pathTokens.slice(0, -1), ...relative] : relative;
	const filled: string[] = [];
	for (const [i, token] of tokens.entries()) {
		if (token !== POINTER_WILDCARD) {
			filled.push(token);
			continue;
		}
		const actual = pathTokens[i];
		if (actual === undefined) return undefined;
		filled.push(actual);
	}
	const { found, value } = lookupPointer(data, formatPointer(filled));
	return found ? value : undefined;
}

function compareNumber(
	value: unknown,
	bound: unknown,
	test: (a: number, b: number) => boolean
): boolean {
	return typeof value === "number" && typeof bound === "number" && test(value, bound);
}

/**
 * 条件形态不可识别时求值为 false; 字段不存在时 eq in 为假, ne 为真;
 * gt gte lt lte 只比较数值, 任一侧不是数值时为假.
 */
export function evaluateCondition(cond: Condition, data: unknown, dataPath: JsonPointer): boolean {
	const c: unknown = cond;
	if (!isPlainObject(c)) return false;
	if (c.op === "and")
		return (
			Array.isArray(c.conditions) &&
			c.conditions.length > 0 &&
			c.conditions.every((sub: Condition) => evaluateCondition(sub, data, dataPath))
		);
	if (c.op === "or")
		return (
			Array.isArray(c.conditions) &&
			c.conditions.some((sub: Condition) => evaluateCondition(sub, data, dataPath))
		);
	if (c.op === "not") return !evaluateCondition(c.condition as Condition, data, dataPath);
	if (typeof c.left !== "string" || parseLodashPath(c.left) === undefined) return false;
	const value = readField(c.left, c.base, data, dataPath);
	switch (c.op) {
		case "eq":
			return value !== undefined && jsonEqual(value, c.right);
		case "ne":
			return value === undefined || !jsonEqual(value, c.right);
		case "in":
			return (
				Array.isArray(c.right) &&
				value !== undefined &&
				c.right.some(o => jsonEqual(value, o))
			);
		case "notIn":
			return (
				Array.isArray(c.right) &&
				(value === undefined || !c.right.some(option => jsonEqual(value, option)))
			);
		case "truthy":
			return typeof c.right === "boolean" && Boolean(value) === c.right;
		case "gt":
			return compareNumber(value, c.right, (a, b) => a > b);
		case "gte":
			return compareNumber(value, c.right, (a, b) => a >= b);
		case "lt":
			return compareNumber(value, c.right, (a, b) => a < b);
		case "lte":
			return compareNumber(value, c.right, (a, b) => a <= b);
		default:
			return false;
	}
}
