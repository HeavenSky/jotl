// 凤蝶 `if` 表达式(JS 表达式, 编辑器以字段所在对象的数据求值, `$.` 可省略) → `x-ui.visibleIf`;
// 只转换与 JS 求值结果逐值一致的写法, 其余返回 undefined.
import { type Condition, formatPointer } from "@jotl/core";

/**
 * 路径处的数据类型: string number boolean 为已声明的标量, composite 为对象或数组, unknown 为无法确定,
 * invalid 为路径经过标量或数组的非下标成员(JS 会取到 `length` 等原型属性, 与指针取值不一致).
 */
export type IfPathType = "string" | "number" | "boolean" | "composite" | "unknown" | "invalid";

/** 按路径片段(不含 `$`)查数据类型. */
export type IfPathResolver = (tokens: readonly string[]) => IfPathType;

type Literal = string | number | boolean | null;
type Token =
	| { t: "op"; v: string }
	| { t: "ident"; v: string }
	| { t: "str"; v: string }
	| { t: "num"; v: number };

const OPERATORS = [
	"===",
	"!==",
	"==",
	"!=",
	">=",
	"<=",
	"&&",
	"||",
	">",
	"<",
	"!",
	"(",
	")",
	"[",
	"]",
	".",
	",",
	"-",
];
const IDENT_RE = /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*/u;
// 不接受前导零(旧式八进制), 十六进制与 `.5` 这类写法.
const NUMBER_RE = /^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const INDEX_RE = /^(?:0|[1-9]\d*)$/;
const ESCAPES: Readonly<Record<string, string>> = {
	"\\": "\\",
	"'": "'",
	'"': '"',
	n: "\n",
	t: "\t",
	r: "\r",
	b: "\b",
	f: "\f",
	v: "\v",
	"/": "/",
};

class Fail extends Error {}

function fail(): never {
	throw new Fail();
}

function tokenize(source: string): Token[] {
	const out: Token[] = [];
	let i = 0;
	while (i < source.length) {
		const rest = source.slice(i);
		const space = /^\s+/.exec(rest);
		if (space !== null) {
			i += space[0].length;
			continue;
		}
		const ch = source[i]!;
		if (ch === "'" || ch === '"') {
			let value = "";
			let j = i + 1;
			for (;;) {
				const c = source[j];
				if (c === undefined || c === "\n" || c === "\r") fail();
				if (c === ch) break;
				if (c === "\\") {
					const next = source[j + 1];
					if (next === "u") {
						const hex = /^[0-9a-fA-F]{4}/.exec(source.slice(j + 2));
						if (hex === null) fail();
						value += String.fromCharCode(Number.parseInt(hex[0], 16));
						j += 6;
						continue;
					}
					if (next === undefined || !Object.hasOwn(ESCAPES, next)) fail();
					value += ESCAPES[next];
					j += 2;
					continue;
				}
				value += c;
				j += 1;
			}
			out.push({ t: "str", v: value });
			i = j + 1;
			continue;
		}
		// 数字只在不紧跟 `.` 或 `[` 时出现(路径中的 `[0]` 也按数字处理).
		const num = NUMBER_RE.exec(rest);
		if (num !== null) {
			if (IDENT_RE.test(rest.slice(num[0].length)) || /^\d/.test(rest.slice(num[0].length)))
				fail();
			const value = Number(num[0]);
			if (!Number.isFinite(value)) fail();
			out.push({ t: "num", v: value });
			i += num[0].length;
			continue;
		}
		const ident = IDENT_RE.exec(rest);
		if (ident !== null) {
			out.push({ t: "ident", v: ident[0] });
			i += ident[0].length;
			continue;
		}
		const op = OPERATORS.find(o => rest.startsWith(o));
		if (op === undefined) fail();
		out.push({ t: "op", v: op });
		i += op.length;
	}
	return out;
}

type Compare = "===" | "!==" | "==" | "!=" | ">" | ">=" | "<" | "<=";
const COMPARES: ReadonlySet<string> = new Set(["===", "!==", "==", "!=", ">", ">=", "<", "<="]);
const FLIPPED: Readonly<Record<string, Compare>> = { ">": "<", ">=": "<=", "<": ">", "<=": ">=" };

type Operand = { path: string[] } | { literal: Literal };

class Parser {
	private i = 0;

	constructor(
		private readonly tokens: Token[],
		private readonly resolve: IfPathResolver
	) {}

	parse(): Condition {
		const c = this.or();
		if (this.peek() !== undefined) fail();
		return c;
	}

	private peek(): Token | undefined {
		return this.tokens[this.i];
	}

	private isOp(v: string): boolean {
		const t = this.peek();
		return t?.t === "op" && t.v === v;
	}

	private expectOp(v: string): void {
		if (!this.isOp(v)) fail();
		this.i += 1;
	}

	private or(): Condition {
		const items = [this.and()];
		while (this.isOp("||")) {
			this.i += 1;
			items.push(this.and());
		}
		return group("any", items);
	}

	private and(): Condition {
		const items = [this.unary()];
		while (this.isOp("&&")) {
			this.i += 1;
			items.push(this.unary());
		}
		return group("all", items);
	}

	/** `!x`, `(x)` 与 `[...].includes(x)` 之后不能再接比较运算符: JS 中 `!$.a === 1` 比较的是布尔值. */
	private unary(): Condition {
		let c: Condition;
		if (this.isOp("!") || this.isOp("(") || this.isOp("[")) c = this.negatable();
		else c = this.comparison();
		const next = this.peek();
		if (next?.t === "op" && COMPARES.has(next.v)) fail();
		return c;
	}

	private negatable(): Condition {
		if (this.isOp("!")) {
			this.i += 1;
			return negate(this.negatable());
		}
		if (this.isOp("(")) {
			this.i += 1;
			const c = this.or();
			this.expectOp(")");
			return c;
		}
		if (this.isOp("[")) return this.includes();
		const path = this.path();
		if (path === undefined) fail();
		return this.leaf(path, { truthy: true });
	}

	/**
	 * `['a', 1].includes($.x)` → `in`: 元素只能是常量, 标量间 SameValueZero 与 JSON 相等一致,
	 * 字段缺失或为对象数组时两边都为假. 不接受第二个参数(起始下标).
	 */
	private includes(): Condition {
		this.expectOp("[");
		const options: Literal[] = [];
		while (!this.isOp("]")) {
			const item = this.operand();
			if (!("literal" in item)) fail();
			options.push(item.literal);
			if (!this.isOp(",")) break;
			this.i += 1;
		}
		this.expectOp("]");
		this.expectOp(".");
		const name = this.peek();
		if (name?.t !== "ident" || name.v !== "includes") fail();
		this.i += 1;
		this.expectOp("(");
		const path = this.path();
		if (path === undefined) fail();
		this.expectOp(")");
		return this.leaf(path, { in: options });
	}

	private comparison(): Condition {
		const left = this.operand();
		const next = this.peek();
		if (!(next?.t === "op" && COMPARES.has(next.v))) {
			if (!("path" in left)) fail();
			return this.leaf(left.path, { truthy: true });
		}
		this.i += 1;
		const right = this.operand();
		let op = next.v as Compare;
		let path: string[];
		let literal: Literal;
		if ("path" in left && "literal" in right) {
			path = left.path;
			literal = right.literal;
		} else if ("literal" in left && "path" in right) {
			path = right.path;
			literal = left.literal;
			op = FLIPPED[op] ?? op;
		} else fail();
		return this.compare(path, op, literal);
	}

	private compare(path: string[], op: Compare, literal: Literal): Condition {
		switch (op) {
			case "===":
				return this.leaf(path, { eq: literal });
			case "!==":
				return this.leaf(path, { ne: literal });
			case "==":
			case "!=": {
				const positive = op === "==";
				// `== null` 恰在值为 undefined 或 null 时成立: 假值中去掉 false 0 "".
				if (literal === null) {
					return positive
						? {
								all: [
									this.leaf(path, { truthy: false }),
									this.leaf(path, { notIn: [false, 0, ""] }),
								],
							}
						: {
								any: [
									this.leaf(path, { truthy: true }),
									this.leaf(path, { in: [false, 0, ""] }),
								],
							};
				}
				// 宽松相等只在字段类型与字面量类型相同时等于严格相等.
				if (this.typeOf(path) !== typeof literal) fail();
				return this.leaf(path, positive ? { eq: literal } : { ne: literal });
			}
			default: {
				// JS 的大小比较会把字符串, 布尔与 null 转成数字; 只有字段声明为数值时与 gt gte lt lte 一致.
				if (typeof literal !== "number" || this.typeOf(path) !== "number") fail();
				const keyword = { ">": "gt", ">=": "gte", "<": "lt", "<=": "lte" }[op];
				return this.leaf(path, { [keyword]: literal });
			}
		}
	}

	private typeOf(path: string[]): IfPathType {
		return this.resolve(path);
	}

	private leaf(path: string[], test: Record<string, unknown>): Condition {
		if (this.resolve(path) === "invalid") fail();
		return { field: formatPointer(path), ...test } as Condition;
	}

	private operand(): Operand {
		const path = this.path();
		if (path !== undefined) return { path };
		const t = this.peek();
		if (t === undefined) fail();
		if (t.t === "str") {
			this.i += 1;
			return { literal: t.v };
		}
		if (t.t === "num") {
			this.i += 1;
			return { literal: t.v === 0 ? 0 : t.v };
		}
		// 负数字面量: 一元负号紧跟数字.
		if (this.isOp("-")) {
			const n = this.tokens[this.i + 1];
			if (n?.t !== "num") fail();
			this.i += 2;
			return { literal: n.v === 0 ? 0 : -n.v };
		}
		if (t.t === "ident" && (t.v === "true" || t.v === "false" || t.v === "null")) {
			this.i += 1;
			return { literal: t.v === "null" ? null : t.v === "true" };
		}
		return fail();
	}

	/** `$.a.b[0]['c']`; 当前不是 `$` 时返回 undefined. 至少一个片段. */
	private path(): string[] | undefined {
		const head = this.peek();
		if (head?.t !== "ident" || head.v !== "$") return undefined;
		this.i += 1;
		const tokens: string[] = [];
		for (;;) {
			if (this.isOp(".")) {
				this.i += 1;
				const name = this.peek();
				if (name?.t !== "ident") fail();
				tokens.push(name.v);
				this.i += 1;
			} else if (this.isOp("[")) {
				this.i += 1;
				const key = this.peek();
				if (key?.t === "str") tokens.push(key.v);
				else if (key?.t === "num" && INDEX_RE.test(String(key.v)))
					tokens.push(String(key.v));
				else fail();
				this.i += 1;
				this.expectOp("]");
			} else break;
		}
		if (tokens.length === 0) fail();
		// 调用(`$.a.includes(...)`)等后缀交给上层按多余记号拒绝.
		return tokens;
	}
}

function group(key: "all" | "any", items: Condition[]): Condition {
	if (items.length === 1) return items[0]!;
	const flat: Condition[] = [];
	for (const item of items) {
		if (key in item) flat.push(...(item as Record<typeof key, Condition[]>)[key]);
		else flat.push(item);
	}
	return { [key]: flat } as Condition;
}

function negate(c: Condition): Condition {
	if ("truthy" in c) return { ...c, truthy: !c.truthy };
	// in 与 notIn 恰好互补(字段缺失时 in 为假, notIn 为真).
	if ("in" in c) {
		const { in: options, ...rest } = c;
		return { ...rest, notIn: options };
	}
	if ("notIn" in c) {
		const { notIn: options, ...rest } = c;
		return { ...rest, in: options };
	}
	if ("not" in c) return c.not;
	return { not: c };
}

/** 解析凤蝶 `if` 表达式; 不能逐值等价地表示为 visibleIf 时返回 undefined. */
export function parseIfExpression(source: string, resolve: IfPathResolver): Condition | undefined {
	try {
		const tokens = tokenize(source);
		if (tokens.length === 0) return undefined;
		return new Parser(tokens, resolve).parse();
	} catch (error) {
		if (error instanceof Fail) return undefined;
		throw error;
	}
}

/**
 * 凤蝶 `$.` 相对字段所在对象求值(simple-evaluate 的 context 是该对象的数据, 无前缀等价),
 * 对应 visibleIf 叶子的 `base: "node"`; 递归应用到组合条件的每个叶子.
 */
export function withNodeBase(condition: Condition): Condition {
	const c: unknown = condition;
	if (Array.isArray((c as { all?: Condition[] }).all))
		return { all: (c as { all: Condition[] }).all.map(withNodeBase) } as Condition;
	if (Array.isArray((c as { any?: Condition[] }).any))
		return { any: (c as { any: Condition[] }).any.map(withNodeBase) } as Condition;
	if (Object.hasOwn(c as object, "not"))
		return { not: withNodeBase((c as { not: Condition }).not) } as Condition;
	return { ...condition, base: "node" };
}
