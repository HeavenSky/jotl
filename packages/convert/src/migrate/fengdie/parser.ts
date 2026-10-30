// fengdie DSL schema 语法分析: 按凤蝶编辑器文法(`parse/schema.yy`)的产生式递归下降, 与 jison 一样在第一个错误处停止.
import { type Diagnostic, type Result, type SourceRange, formatMessage, l10n } from "@jotl/core";
import type {
	EnumProp,
	Export,
	FengdieDocument,
	Label,
	LeafProp,
	Meta,
	MetaEntry,
	Name,
	NestedProp,
	Prop,
	RootSchema,
} from "./ast.js";
import {
	ACTUAL_TEMPLATE,
	expectedSeparator,
	migrateDiagnostic,
	tokenLabel,
} from "./diagnostics.js";
import { Lexer, type Token, type TokenKind } from "./lexer.js";
import { LineMap } from "./line-map.js";

/** 只在本模块内抛出并捕获, 用于在第一个错误处结束分析. */
class Stop {
	constructor(readonly diagnostic: Diagnostic) {}
}

function spanOf(from: SourceRange, to: SourceRange): SourceRange {
	return { file: from.file, start: from.start, end: to.end };
}

const lower = (s: string) => s.toLowerCase();

/** `Spm` 字段由文法固定展开的三个子字段. */
const SPM_PROPS: readonly [string, string, string][] = [
	["spma", "a位", "SPM a"],
	["spmb", "b位", "SPM b"],
	["spmc", "c位", "SPM c"],
];

class Parser {
	private readonly lexer: Lexer;
	private current: Token;

	constructor(text: string, file: string) {
		this.lexer = new Lexer(text, new LineMap(text, file));
		this.current = this.pull();
	}

	/** expressions: schema EOF | exports EOF. */
	document(): FengdieDocument {
		if (this.at() === "EXPORT") {
			const exports: Export[] = [];
			while (this.at() === "EXPORT") exports.push(this.exportDecl());
			this.expect(["EXPORT", "EOF"]);
			return { kind: "exports", exports };
		}
		const schema = this.rootSchema(["EXPORT"]);
		this.expect(["EOF"]);
		return { kind: "schema", schema };
	}

	/** export: EXPORT VAR schema. */
	private exportDecl(): Export {
		this.advance();
		const name = this.name(this.expect(["VAR"]));
		return { name, schema: this.rootSchema([]) };
	}

	/** schema: array | object; 类型名按各产生式的动作求出. */
	private rootSchema(alternatives: readonly TokenKind[]): RootSchema {
		let publicRange: SourceRange | undefined;
		if (this.at() === "PUBLIC") {
			publicRange = this.current.range;
			this.advance();
		}
		const isPublic = publicRange !== undefined;
		const keyword = this.expect(
			isPublic
				? ["ARRAY", "OBJECT", "LOTTERY"]
				: ["PUBLIC", "ARRAY", "OBJECT", "LOTTERY", "OPEN_ACTION", "ACTION", ...alternatives]
		);
		const label = this.label(this.expect(["STRING"]));
		const meta = this.at() === "METASTART" ? this.meta() : undefined;
		// 只有不带 public 的 OBJECT 允许空体 `{}`.
		const props = this.block(
			meta === undefined ? ["METASTART", "START"] : ["START"],
			keyword.kind === "OBJECT" && !isPublic
		);
		const text = keyword.text;
		let type: string;
		switch (keyword.kind) {
			case "ARRAY":
				if (isPublic) type = "array";
				else if (meta !== undefined)
					type = lower(text) === "modulearray" ? "modulearray" : "array";
				else type = lower(text) === "array" ? "array" : text;
				break;
			case "OBJECT":
				if (isPublic) type = "object";
				else if (meta !== undefined) type = lower(text) === "module" ? "module" : "object";
				else type = lower(text) === "object" ? "object" : text.replace("[Object]", "");
				break;
			case "OPEN_ACTION":
				type = "openaction";
				break;
			case "ACTION":
				type = "action";
				break;
			default:
				type = "object";
		}
		const schema: RootSchema = {
			type,
			range: publicRange ?? keyword.range,
			lottery: keyword.kind === "LOTTERY",
			label,
			props,
		};
		if (publicRange !== undefined) schema.publicRange = publicRange;
		if (meta !== undefined) schema.meta = meta;
		return schema;
	}

	/** START props END; props: prop | props prop. allowEmpty 时另接受 START END. */
	private block(expected: readonly TokenKind[], allowEmpty: boolean): Prop[] {
		this.expect(expected);
		const props: Prop[] = [];
		if (allowEmpty && this.at() === "END") {
			this.advance();
			return props;
		}
		props.push(this.prop(allowEmpty ? ["VAR", "END"] : ["VAR"]));
		while (this.at() !== "END") props.push(this.prop(["VAR", "END"]));
		this.advance();
		return props;
	}

	/** prop 的各产生式. */
	private prop(expected: readonly TokenKind[]): Prop {
		const key = this.name(this.expect(expected));
		const label = this.label(this.expect(["STRING"]));
		if (this.at() !== "COLON") return { kind: "leaf", key, label, path: [] };
		this.advance();
		const head = this.expect([
			"VAR",
			"OBJECT",
			"ARRAY",
			"ACTION",
			"OPEN_ACTION",
			"ENUM",
			"SPM",
		]);
		const text = head.text;
		switch (head.kind) {
			case "VAR":
				return this.leaf(key, label, head);
			case "ENUM":
				return this.enumProp(key, label);
			case "SPM": {
				const props: Prop[] = SPM_PROPS.map(([k, zh, en]) => ({
					kind: "leaf",
					key: { text: k, range: head.range },
					label: { text: l10n(zh, en), range: head.range },
					path: [],
				}));
				return { kind: "nested", key, label, type: "spm", typeRange: head.range, props };
			}
			case "ACTION":
			case "OPEN_ACTION": {
				const meta = this.at() === "METASTART" ? this.meta() : undefined;
				const props = this.block(
					meta === undefined ? ["METASTART", "START"] : ["START"],
					true
				);
				return this.nested(
					key,
					label,
					head.kind === "ACTION" ? "action" : "openAction",
					head,
					props,
					meta
				);
			}
			case "OBJECT": {
				if (this.at() === "START") {
					const type = lower(text) === "object" ? "object" : text.replace("[Object]", "");
					return this.nested(
						key,
						label,
						type,
						head,
						this.block(["START"], true),
						undefined
					);
				}
				const meta = this.meta(["METASTART", "START"]);
				if (this.at() !== "START")
					return this.nested(key, label, lower(text), head, [], meta);
				return this.nested(
					key,
					label,
					lower(text) === "module" ? "module" : "object",
					head,
					this.block(["START"], true),
					meta
				);
			}
			default: {
				// ARRAY
				if (this.at() === "TYPESTRING") {
					const element = this.current;
					this.advance();
					const leaf: LeafProp = {
						kind: "leaf",
						key,
						label,
						path: [
							{
								text: `array${element.value || "string"}`,
								range: spanOf(head.range, element.range),
							},
						],
					};
					if (this.at() === "METASTART") leaf.meta = this.meta();
					return leaf;
				}
				if (this.at() === "START") {
					const type = lower(text) === "array" ? "array" : text;
					return this.nested(
						key,
						label,
						type,
						head,
						this.block(["START"], false),
						undefined
					);
				}
				const meta = this.meta(["METASTART", "START", "TYPESTRING"]);
				if (this.at() !== "START")
					return this.nested(key, label, lower(text), head, [], meta);
				return this.nested(
					key,
					label,
					lower(text) === "modulearray" ? "modulearray" : "array",
					head,
					this.block(["START"], false),
					meta
				);
			}
		}
	}

	private nested(
		key: Name,
		label: Label,
		type: string,
		head: Token,
		props: Prop[],
		meta: Meta | undefined
	): NestedProp {
		const nested: NestedProp = {
			kind: "nested",
			key,
			label,
			type,
			typeRange: head.range,
			props,
		};
		if (meta !== undefined) nested.meta = meta;
		return nested;
	}

	/** var: VAR | var DOT VAR, 其后可带 meta. */
	private leaf(key: Name, label: Label, head: Token): LeafProp {
		const path: Name[] = [this.name(head)];
		while (this.at() === "DOT") {
			this.advance();
			path.push(this.name(this.expect(["VAR"])));
		}
		const leaf: LeafProp = { kind: "leaf", key, label, path };
		if (this.at() === "METASTART") leaf.meta = this.meta();
		return leaf;
	}

	/** ENUM START props END | ENUM meta START props END | ENUM meta. */
	private enumProp(key: Name, label: Label): EnumProp {
		if (this.at() === "START")
			return { kind: "enum", key, label, items: this.block(["START"], false) };
		const meta = this.meta(["START", "METASTART"]);
		const items = this.at() === "START" ? this.block(["START"], false) : [];
		return { kind: "enum", key, label, items, meta };
	}

	/** meta: METASTART metaprops METAEND; metaprops: metaprop | metaprops metaprop. */
	private meta(expected: readonly TokenKind[] = ["METASTART"]): Meta {
		const open = this.expect(expected);
		const entries: MetaEntry[] = [this.metaEntry(["VAR"])];
		while (this.at() !== "METAEND") entries.push(this.metaEntry(["VAR", "METAEND"]));
		const close = this.current;
		this.advance();
		return { entries, range: spanOf(open.range, close.range) };
	}

	/** metaprop: VAR COLON (METAVALUE_STRING | METAVALUE_NUMBER | METAVALUE_BOOL). */
	private metaEntry(expected: readonly TokenKind[]): MetaEntry {
		const keyToken = this.expect(expected);
		this.expect(["COLON"]);
		const valueToken = this.expect(["METAVALUE_STRING", "METAVALUE_NUMBER", "METAVALUE_BOOL"]);
		let value: string | number | boolean = valueToken.value;
		if (valueToken.kind === "METAVALUE_NUMBER") value = Number.parseFloat(valueToken.value);
		else if (valueToken.kind === "METAVALUE_BOOL") value = valueToken.value === "true";
		return { key: this.name(keyToken), value, range: spanOf(keyToken.range, valueToken.range) };
	}

	private at(): TokenKind {
		return this.current.kind;
	}

	private name(token: Token): Name {
		return { text: token.value, range: token.range };
	}

	private label(token: Token): Label {
		return { text: token.value, range: token.range };
	}

	/** 当前记号属于 expected 时消费并返回它, 否则以 JOTL8002 结束分析. */
	private expect(expected: readonly TokenKind[]): Token {
		const token = this.current;
		if (!expected.includes(token.kind)) {
			const actual =
				token.kind === "EOF"
					? tokenLabel("EOF")
					: formatMessage(ACTUAL_TEMPLATE, { text: token.text });
			const names = [...new Set(expected.map(k => tokenLabel(k)))].join(expectedSeparator());
			throw new Stop(
				migrateDiagnostic(
					"JOTL8002",
					{ expected: names, actual },
					{ location: { kind: "source", range: token.range } }
				)
			);
		}
		if (token.kind !== "EOF") this.advance();
		return token;
	}

	private advance(): void {
		this.current = this.pull();
	}

	private pull(): Token {
		const next = this.lexer.next();
		if ("code" in next) throw new Stop(next);
		return next;
	}
}

/** 解析 fengdie DSL schema; 有错误时 value 为 undefined, 诊断只含第一个错误. */
export function parseFengdie(text: string, file: string): Result<FengdieDocument> {
	try {
		return { value: new Parser(text, file).document(), diagnostics: [] };
	} catch (error) {
		if (error instanceof Stop) return { value: undefined, diagnostics: [error.diagnostic] };
		throw error;
	}
}
