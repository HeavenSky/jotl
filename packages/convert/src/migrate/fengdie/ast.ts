// 凤蝶 schema 语法树: 与 umo-edit-sdk `parse/schema.yy` 各产生式的产出一一对应, 另带源码位置.
import type { SourceRange } from "@jotl/core";

export interface Name {
	text: string;
	range: SourceRange;
}

/** `(...)` 中的说明原文. */
export type Label = Name;

export interface MetaEntry {
	key: Name;
	value: string | number | boolean;
	range: SourceRange;
}

export interface Meta {
	entries: MetaEntry[];
	range: SourceRange;
}

/** 顶层 schema; type 已按 schema.yy 的产出规则求出(如 `array` `modulearray` `ns.Comp[Array]` `openaction`). */
export interface RootSchema {
	type: string;
	/** 首个记号(`public` 或类型关键字)的位置. */
	range: SourceRange;
	publicRange?: SourceRange;
	lottery: boolean;
	label: Label;
	meta?: Meta;
	props: Prop[];
}

export interface Export {
	name: Name;
	schema: RootSchema;
}

export type FengdieDocument =
	| { kind: "schema"; schema: RootSchema }
	| { kind: "exports"; exports: Export[] };

interface PropBase {
	key: Name;
	label: Label;
	meta?: Meta;
}

/** `key(说明)`, `key(说明): a.b[...]` 与 `key(说明): Array<string>`(path 为 `arraystring`). */
export interface LeafProp extends PropBase {
	kind: "leaf";
	/** 点号类型路径的各段, 省略类型时为空. */
	path: Name[];
}

/** 带子字段的写法: Object Array Action OpenAction Module ModuleArray `ns.Comp` Spm; type 已按 schema.yy 求出. */
export interface NestedProp extends PropBase {
	kind: "nested";
	type: string;
	typeRange: SourceRange;
	props: Prop[];
}

/** `key(说明): Enum {...}`, `Enum[...] {...}` 与 `Enum[...]`. */
export interface EnumProp extends PropBase {
	kind: "enum";
	items: Prop[];
}

export type Prop = LeafProp | NestedProp | EnumProp;
