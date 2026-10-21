// 补全上下文: 从文件开头扫描到光标, 判定光标处可补全的语法位置(组件, 元数据键, widget 取值, 条件 op, 类型串, 标识记号, `item_meta` 与 `variants` 内的键); 容忍不完整的源码.

export type CompletionContext =
	| { kind: "none" }
	| { kind: "component" }
	| { kind: "marker" }
	/** component 为条目写下的组件名, undefined 表示省略组件; top 为顶层条目. */
	| {
			kind: "metaKey";
			component: string | undefined;
			top: boolean;
			enumMember: boolean;
			used: readonly string[];
	  }
	| { kind: "widget"; component: string | undefined; quoted: boolean }
	| { kind: "decorator"; quoted: boolean }
	| { kind: "valueFormat"; component: string | undefined; quoted: boolean }
	| { kind: "conditionOp"; quoted: boolean }
	| { kind: "typeString" }
	/** `variants` 场景覆盖对象的键. */
	| { kind: "sceneKey"; used: readonly string[] }
	/** 按名字分键的 `item_meta` 的键: 类型串中的名字. */
	| { kind: "itemMetaName"; names: readonly string[]; used: readonly string[] };

export interface CompletionSite {
	context: CompletionContext;
	/** 补全项替换范围的起点偏移; 终点是光标. */
	replaceStart: number;
}

type EntryState = "key" | "afterKey" | "content" | "afterComponent" | "afterMeta";
type MemberState = "key" | "afterKey" | "value" | "afterValue";

/** 文件与体: 条目序列. */
interface EntriesFrame {
	kind: "entries";
	top: boolean;
	enumBody: boolean;
	state: EntryState;
	component: string | undefined;
}

/** 元数据 `[...]` 与元数据中的对象值 `{...}`. */
interface MembersFrame {
	kind: "meta" | "object";
	state: MemberState;
	key: string | undefined;
	used: string[];
	/** 处在 `root_if` / `node_if` 的取值内. */
	condition: boolean;
	/** meta 帧: 所属条目的组件, 是否在顶层, 是否为枚举成员. */
	component: string | undefined;
	top: boolean;
	enumMember: boolean;
	/** object 帧的角色: 内部类型的元数据(`item_meta`, 按元数据处理), 按名字分键的 `item_meta`, `variants` 及其场景覆盖. */
	role: "itemMeta" | "keyedItemMeta" | "variants" | "scene" | undefined;
	/** 本帧已读到的类型串中的名字; keyedItemMeta 帧为分键的名字. */
	itemTypes: string[] | undefined;
}

/** 元数据中的数组值 `[...]`. */
interface ArrayFrame {
	kind: "array";
	condition: boolean;
}

type Frame = EntriesFrame | MembersFrame | ArrayFrame;

type Token =
	| { type: "ident"; text: string }
	| { type: "string"; value: string }
	| { type: "number" }
	| { type: "punct"; text: string }
	| { type: "junk" };

const IDENT_RE = /[\p{ID_Start}$_](?:[\p{ID_Continue}$-]|\u200C|\u200D)*/uy;
const NUMBER_RE = /[+-]?(?:\d|\.\d)[\w.]*/y;
const MARKER_RE = /<(?:root|default)\/>/y;
const PUNCTUATORS = new Set(["{", "}", "[", "]", ":", ",", ";", "?", "*"]);
const WORD_BEFORE_CURSOR_RE = /(?:[\p{ID_Continue}$-]|\u200C|\u200D)*$/u;
const CONDITION_KEYS: ReadonlySet<string> = new Set(["root_if", "node_if"]);
const TYPE_STRING_KEYS: ReadonlySet<string> = new Set([
	"array_item",
	"map_item",
	"union_item",
	"json_item",
]);

type EndState =
	| { kind: "code" }
	| { kind: "comment" }
	| { kind: "label" }
	| { kind: "string"; contentStart: number; content: string };

function members(kind: "meta" | "object", condition: boolean, entry?: EntriesFrame): MembersFrame {
	return {
		kind,
		state: "key",
		key: undefined,
		used: [],
		condition,
		component: entry?.component,
		top: entry?.top ?? false,
		enumMember: entry?.enumBody ?? false,
		role: undefined,
		itemTypes: undefined,
	};
}

function isMetaLike(frame: MembersFrame): boolean {
	return frame.kind === "meta" || frame.role === "itemMeta";
}

function nested(
	role: MembersFrame["role"],
	component: string | undefined,
	condition: boolean,
	itemTypes?: string[]
): MembersFrame {
	return { ...members("object", condition), role, component, itemTypes };
}

/** 字符串从开引号之后的 from 起, 返回结束引号之后的偏移; 到文本末尾仍未结束时返回 undefined; 换行处视为字符串结束. */
function skipString(text: string, from: number, quote: string): number | undefined {
	for (let i = from; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\\") i++;
		else if (ch === quote) return i + 1;
		else if (ch === "\n" || ch === "\r") return i;
	}
	return undefined;
}

/**
 * `item_meta` 写在 `*_item` 之前时向后找类型串: 从 item_meta 值的 `{` 起扫完整源码, 跳过该值后在同级成员中找 `*_item: '...'`, 遇到所在元数据的闭括号为止.
 * 源码不完整(值未闭合, 字符串或注释到文件末尾)时找不到, 返回 undefined.
 */
function followingItemTypes(text: string, open: number): string[] | undefined {
	let depth = 0;
	let key: string | undefined;
	let colon = false;
	let i = open;
	while (i < text.length) {
		const ch = text[i]!;
		if (/\s/u.test(ch)) {
			i++;
			continue;
		}
		if (ch === "/" && text[i + 1] === "/") {
			const newline = text.slice(i).search(/[\r\n]/);
			if (newline < 0) return undefined;
			i += newline;
			continue;
		}
		if (ch === "/" && text[i + 1] === "*") {
			const close = text.indexOf("*/", i + 2);
			if (close < 0) return undefined;
			i = close + 2;
			continue;
		}
		let tok: string | undefined;
		if (ch === '"' || ch === "'") {
			const stop = skipString(text, i + 1, ch);
			if (stop === undefined) return undefined;
			tok = text.slice(i + 1, stop - 1);
			i = stop;
		} else {
			IDENT_RE.lastIndex = i;
			const ident = IDENT_RE.exec(text);
			i += ident ? ident[0].length : 1;
			if (ident) tok = ident[0];
			else if (ch === "{" || ch === "[") depth++;
			else if (ch === "}" || ch === "]") {
				depth--;
				if (depth < 0) return undefined;
			}
		}
		if (depth !== 0) continue;
		// 同级成员: 键, `:`, 取值; 只认取值为字符串的 `*_item`.
		if (tok !== undefined && colon) {
			if (TYPE_STRING_KEYS.has(key ?? "") && /['"]/.test(ch))
				return tok.split("|").map(name => name.trim());
			key = undefined;
			colon = false;
		} else if (tok !== undefined) key = tok;
		else if (ch === ":") colon = key !== undefined;
		else {
			key = undefined;
			colon = false;
		}
	}
	return undefined;
}

/** 元数据对象值 `{` 的帧; 没有类型串的 `item_meta` 是元素对象或分支对象的元数据; 类型串写在 item_meta 之后时向后找. */
function objectValueFrame(
	parent: MembersFrame,
	condition: boolean,
	source: string,
	open: number
): MembersFrame {
	const key = parent.key ?? "";
	if (isMetaLike(parent) && key === "variants")
		return nested("variants", parent.component, condition);
	if (isMetaLike(parent) && key === "item_meta") {
		const names = parent.itemTypes ?? followingItemTypes(source, open);
		if (names !== undefined && names.length > 1)
			return nested("keyedItemMeta", undefined, condition, names);
		const component =
			names === undefined ? "object" : names[0] === "tuple" ? undefined : names[0];
		return nested("itemMeta", component, condition);
	}
	if (parent.role === "variants") return nested("scene", parent.component, condition);
	if (parent.role === "keyedItemMeta" && parent.itemTypes?.includes(key))
		return nested("itemMeta", key, condition);
	return members("object", condition);
}

class PrefixScanner {
	private readonly stack: Frame[] = [
		{ kind: "entries", top: true, enumBody: false, state: "key", component: undefined },
	];
	/** 刚读完条目键, 下一个 `(` 是标签. */
	private labelAllowed = false;

	/** 当前记号的起点偏移. */
	private pos = 0;

	/** text 只含光标之前的部分; source 为完整源码, 只用于向后找 item_meta 的类型串. */
	constructor(
		private readonly text: string,
		private readonly source: string
	) {}

	get top(): Frame {
		return this.stack[this.stack.length - 1]!;
	}

	scan(): EndState {
		const text = this.text;
		const end = text.length;
		let i = 0;
		while (i < end) {
			const ch = text[i]!;
			this.pos = i;
			if (/\s/u.test(ch)) {
				i++;
				continue;
			}
			if (ch === "/" && text[i + 1] === "/") {
				const newline = text.slice(i, end).search(/[\r\n]/);
				if (newline < 0) return { kind: "comment" };
				i += newline;
				continue;
			}
			if (ch === "/" && text[i + 1] === "*") {
				const close = text.indexOf("*/", i + 2);
				if (close < 0) return { kind: "comment" };
				i = close + 2;
				continue;
			}
			if (ch === '"' || ch === "'") {
				const stop = this.skipString(i + 1, ch);
				if (stop === undefined)
					return { kind: "string", contentStart: i + 1, content: text.slice(i + 1) };
				this.token({ type: "string", value: text.slice(i + 1, stop - 1) });
				i = stop;
				continue;
			}
			if (ch === "(" && this.labelAllowed) {
				const stop = this.skipLabel(i + 1);
				if (stop === undefined) return { kind: "label" };
				i = stop;
				this.labelAllowed = false;
				continue;
			}
			MARKER_RE.lastIndex = i;
			const marker = MARKER_RE.exec(text);
			if (marker) {
				i += marker[0].length;
				this.labelAllowed = false;
				continue;
			}
			IDENT_RE.lastIndex = i;
			const ident = IDENT_RE.exec(text);
			if (ident) {
				i += ident[0].length;
				this.token({ type: "ident", text: ident[0] });
				continue;
			}
			NUMBER_RE.lastIndex = i;
			const number = NUMBER_RE.exec(text);
			if (number) {
				i += number[0].length;
				this.token({ type: "number" });
				continue;
			}
			i++;
			this.token(PUNCTUATORS.has(ch) ? { type: "punct", text: ch } : { type: "junk" });
		}
		return { kind: "code" };
	}

	/** 返回结束引号之后的偏移; 到光标仍未结束时返回 undefined; 换行处视为字符串结束. */
	private skipString(from: number, quote: string): number | undefined {
		return skipString(this.text, from, quote);
	}

	/** 标签到配对的 `)`, 允许成对嵌套, `\(` `\)` `\\` 为转义; 换行处视为标签结束. */
	private skipLabel(from: number): number | undefined {
		let depth = 0;
		for (let i = from; i < this.text.length; i++) {
			const ch = this.text[i];
			if (ch === "\\") i++;
			else if (ch === "(") depth++;
			else if (ch === ")") {
				if (depth === 0) return i + 1;
				depth--;
			} else if (ch === "\n" || ch === "\r") return i;
		}
		return undefined;
	}

	private token(tok: Token): void {
		this.labelAllowed = false;
		if (tok.type === "punct" && (tok.text === "}" || tok.text === "]")) {
			this.close(tok.text);
			return;
		}
		const frame = this.top;
		if (frame.kind === "entries") this.entryToken(frame, tok);
		else if (frame.kind === "array") this.valueToken(tok, frame.condition);
		else this.memberToken(frame, tok);
	}

	private newKey(frame: EntriesFrame): void {
		frame.state = "afterKey";
		frame.component = undefined;
		this.labelAllowed = true;
	}

	private entryToken(frame: EntriesFrame, tok: Token): void {
		const isKey =
			tok.type === "ident" ||
			tok.type === "string" ||
			tok.type === "number" ||
			isPunct(tok, "*");
		if (isPunct(tok, ",") || isPunct(tok, ";")) {
			frame.state = "key";
			return;
		}
		switch (frame.state) {
			case "content":
				if (tok.type === "ident") {
					frame.component = tok.text;
					frame.state = "afterComponent";
				} else if (isPunct(tok, "[")) this.openMeta(frame);
				else if (isPunct(tok, "{")) this.openBody(frame);
				return;
			case "afterKey":
				if (isPunct(tok, "?")) return;
				if (isPunct(tok, ":")) {
					frame.state = "content";
					return;
				}
				if (isPunct(tok, "[")) return this.openMeta(frame);
				if (isPunct(tok, "{")) return this.openBody(frame);
				if (isKey) this.newKey(frame);
				return;
			case "afterComponent":
			case "afterMeta":
				if (isPunct(tok, "[") && frame.state === "afterComponent")
					return this.openMeta(frame);
				if (isPunct(tok, "{")) return this.openBody(frame);
				if (isKey) this.newKey(frame);
				return;
			case "key":
				if (isKey) this.newKey(frame);
				return;
		}
	}

	private openMeta(frame: EntriesFrame): void {
		frame.state = "afterMeta";
		this.stack.push(members("meta", false, frame));
	}

	private openBody(frame: EntriesFrame): void {
		const enumBody = frame.component === "enum";
		frame.state = "key";
		this.stack.push({
			kind: "entries",
			top: false,
			enumBody,
			state: "key",
			component: undefined,
		});
	}

	private memberToken(frame: MembersFrame, tok: Token): void {
		switch (frame.state) {
			case "key":
				if (tok.type === "ident" || tok.type === "string") {
					frame.key = tok.type === "ident" ? tok.text : tok.value;
					frame.used.push(frame.key);
					frame.state = "afterKey";
				}
				return;
			case "afterKey":
				if (isPunct(tok, ":")) frame.state = "value";
				return;
			case "value":
				frame.state = "afterValue";
				if (
					tok.type === "string" &&
					isMetaLike(frame) &&
					TYPE_STRING_KEYS.has(frame.key ?? "")
				) {
					frame.itemTypes = tok.value.split("|").map(name => name.trim());
				}
				this.valueToken(
					tok,
					frame.condition ||
						((isMetaLike(frame) || frame.role === "scene") &&
							CONDITION_KEYS.has(frame.key ?? "")),
					frame
				);
				return;
			case "afterValue":
				if (isPunct(tok, ",")) frame.state = "key";
		}
	}

	private valueToken(tok: Token, condition: boolean, parent?: MembersFrame): void {
		if (isPunct(tok, "{"))
			this.stack.push(
				parent === undefined
					? members("object", condition)
					: objectValueFrame(parent, condition, this.source, this.pos)
			);
		else if (isPunct(tok, "[")) this.stack.push({ kind: "array", condition });
	}

	/** 弹出到最近的同类帧; 找不到时忽略这个闭括号. */
	private close(closer: string): void {
		const matches = (f: Frame) =>
			closer === "}"
				? (f.kind === "entries" && !f.top) || f.kind === "object"
				: f.kind === "meta" || f.kind === "array";
		let index = this.stack.length - 1;
		while (index > 0 && !matches(this.stack[index]!)) index--;
		if (index === 0) return;
		this.stack.length = index;
	}
}

function isPunct(tok: Token, text: string): boolean {
	return tok.type === "punct" && tok.text === text;
}

function valueContext(frame: MembersFrame, quoted: boolean): CompletionContext {
	if (frame.state !== "value") return { kind: "none" };
	if (frame.role === "scene") {
		if (frame.key === "widget") return { kind: "widget", component: frame.component, quoted };
		if (frame.key === "decorator") return { kind: "decorator", quoted };
	}
	if (isMetaLike(frame)) {
		if (frame.key === "widget") return { kind: "widget", component: frame.component, quoted };
		if (frame.key === "decorator") return { kind: "decorator", quoted };
		if (frame.key === "value_format")
			return { kind: "valueFormat", component: frame.component, quoted };
		if (quoted && TYPE_STRING_KEYS.has(frame.key ?? "")) return { kind: "typeString" };
		return { kind: "none" };
	}
	return frame.condition && frame.key === "op"
		? { kind: "conditionOp", quoted }
		: { kind: "none" };
}

/** offset 为光标的源码偏移. */
export function completionSite(text: string, offset: number): CompletionSite {
	const cursor = Math.max(0, Math.min(offset, text.length));
	const before = text.slice(0, cursor);
	const word = WORD_BEFORE_CURSOR_RE.exec(before)?.[0] ?? "";
	let wordStart = cursor - word.length;
	const markerStart = text[wordStart - 1] === "<" ? wordStart - 1 : undefined;
	if (markerStart !== undefined) wordStart = markerStart;
	const scanner = new PrefixScanner(text.slice(0, wordStart), text);
	const end = scanner.scan();
	const top = scanner.top;
	const none = { context: { kind: "none" } as const, replaceStart: wordStart };
	if (end.kind === "string") {
		if (top.kind === "entries" || top.kind === "array") return none;
		const context = valueContext(top, true);
		// 类型串只替换最后一个 `|` 之后的名字.
		const pipe = end.content.lastIndexOf("|");
		const replaceStart =
			context.kind === "typeString" && pipe >= 0
				? end.contentStart + pipe + 1
				: end.contentStart;
		return {
			context,
			replaceStart:
				context.kind === "typeString"
					? replaceStart + leadingSpace(end.content.slice(pipe + 1))
					: replaceStart,
		};
	}
	if (end.kind !== "code") return none;
	if (top.kind === "entries") {
		if (top.state === "content")
			return markerStart === undefined
				? { context: { kind: "component" }, replaceStart: wordStart }
				: none;
		// 上一条目之后只在换行处或已输入 `<` 时给标识, 免得在组件后的空格处弹出.
		const newLine = top.state === "key" || /[\r\n][^\S\r\n]*$/.test(text.slice(0, wordStart));
		const typed = markerStart !== undefined || (word === "" && newLine);
		if (top.top && typed) return { context: { kind: "marker" }, replaceStart: wordStart };
		return none;
	}
	if (top.kind === "array" || markerStart !== undefined) return none;
	if (top.kind === "object" && top.state === "key") {
		if (top.role === "scene")
			return { context: { kind: "sceneKey", used: top.used }, replaceStart: wordStart };
		if (top.role === "keyedItemMeta")
			return {
				context: { kind: "itemMetaName", names: top.itemTypes ?? [], used: top.used },
				replaceStart: wordStart,
			};
	}
	if (isMetaLike(top) && top.state === "key") {
		const context = {
			kind: "metaKey",
			component: top.component,
			top: top.top,
			enumMember: top.enumMember,
			used: top.used,
		} as const;
		return { context, replaceStart: wordStart };
	}
	return { context: valueContext(top, false), replaceStart: wordStart };
}

function leadingSpace(s: string): number {
	return s.length - s.trimStart().length;
}
