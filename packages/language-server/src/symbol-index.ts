// 符号出现位置索引: 从 AST 收集顶层类型名, 类型引用(组件位置与类型串), 字段键, 内置组件, 元数据键与标识记号的源码偏移, 供悬停, 跳转与查找引用使用.
import {
	type Entry,
	isComponentName,
	isTypeName,
	type JotlFile,
	type JsonSchemaObject,
	type MetaTarget,
	type ObjectValueMember,
	readJotlConfig,
	type ValueNode,
} from "@jotl/core";

export type Occurrence =
	| { kind: "declaration"; name: string; start: number; end: number; entry: Entry }
	| { kind: "typeReference"; name: string; start: number; end: number }
	| { kind: "component"; name: string; start: number; end: number }
	| { kind: "field"; name: string; start: number; end: number; entry: Entry }
	| { kind: "metaKey"; name: string; start: number; end: number; target: MetaTarget | undefined }
	| { kind: "marker"; name: string; start: number; end: number };

/** 取值为类型串的元数据键; 串中的大驼峰名是类型引用. */
export const TYPE_STRING_KEYS: ReadonlySet<string> = new Set([
	"array_item",
	"map_item",
	"union_item",
	"json_item",
]);

function offsets(range: { start: { offset: number }; end: { offset: number } }): {
	start: number;
	end: number;
} {
	return { start: range.start.offset, end: range.end.offset };
}

/** 本文件顶层声明的类型名. */
export function declaredTypeNames(file: JotlFile | undefined): Set<string> {
	const names = new Set<string>();
	for (const entry of file?.entries ?? [])
		if (isTypeName(entry.key.name)) names.add(entry.key.name);
	return names;
}

/** 顶层条目元数据 `widgets` 中声明的名字; 写在非根条目上由编译器报错, 这里不区分. */
export function fileWidgetNames(file: JotlFile | undefined): string[] {
	const names: string[] = [];
	for (const entry of file?.entries ?? []) {
		const member = entry.meta?.members.find(m => m.key.value === "widgets");
		if (member?.value.kind !== "ObjectValue") continue;
		for (const item of member.value.members)
			if (item.key.value !== "") names.push(item.key.value);
	}
	return names;
}

function valueJson(node: ValueNode): unknown {
	if (node.kind === "LiteralValue") return node.value;
	if (node.kind === "ArrayValue") return node.items.map(valueJson);
	const out: Record<string, unknown> = {};
	for (const member of node.members)
		if (!Object.hasOwn(out, member.key.value)) out[member.key.value] = valueJson(member.value);
	return out;
}

/** 顶层条目元数据 `widgets` 中写对了的声明 → 底层 schema, 与编译器同一读法; 同名取先出现的, 写错的项跳过(由编译器报错). */
export function fileWidgetSchemas(file: JotlFile | undefined): Record<string, JsonSchemaObject> {
	const out: Record<string, JsonSchemaObject> = {};
	for (const entry of file?.entries ?? []) {
		const member = entry.meta?.members.find(m => m.key.value === "widgets");
		if (member?.value.kind !== "ObjectValue") continue;
		const { widgets } = readJotlConfig({ widgets: valueJson(member.value) }).config;
		for (const [name, schema] of Object.entries(widgets))
			if (!Object.hasOwn(out, name)) out[name] = schema;
	}
	return out;
}

/** 条目的元数据适用对象; 省略组件时有体为 object, 否则为 string. */
export function metaTarget(entry: Entry, declared: ReadonlySet<string>): MetaTarget | undefined {
	const name = entry.component?.name;
	if (name === undefined) return entry.body !== undefined ? "object" : "string";
	if (isComponentName(name)) return name;
	if (declared.has(name)) return "ref";
	return isTypeName(name) ? "ext" : undefined;
}

class Collector {
	readonly occurrences: Occurrence[] = [];

	constructor(private readonly declared: ReadonlySet<string>) {}

	private push(occurrence: Occurrence): void {
		this.occurrences.push(occurrence);
	}

	private nameRef(name: string, start: number, end: number): void {
		if (isComponentName(name)) this.push({ kind: "component", name, start, end });
		else if (isTypeName(name)) this.push({ kind: "typeReference", name, start, end });
	}

	/** 类型串只在原文没有转义时定位到各个名字. */
	private typeString(members: readonly ObjectValueMember[]): void {
		for (const member of members) {
			if (!TYPE_STRING_KEYS.has(member.key.value) || member.value.kind !== "LiteralValue")
				continue;
			const { value, raw, span } = member.value;
			if (typeof value !== "string" || raw.slice(1, -1) !== value) continue;
			let at = span.range.start.offset + 1;
			for (const part of value.split("|")) {
				const lead = part.length - part.trimStart().length;
				const name = part.trim();
				if (name !== "") this.nameRef(name, at + lead, at + lead + name.length);
				at += part.length + 1;
			}
		}
	}

	private nameTarget(name: string | undefined): MetaTarget | undefined {
		if (name === undefined || isComponentName(name)) return name as MetaTarget | undefined;
		if (this.declared.has(name)) return "ref";
		return isTypeName(name) ? "ext" : undefined;
	}

	/** 元数据键; 递归进 `item_meta`(直接写或按类型串的名字分键)与 `variants` 的场景覆盖. */
	private meta(members: readonly ObjectValueMember[], target: MetaTarget | undefined): void {
		for (const member of members)
			this.push({
				kind: "metaKey",
				name: member.key.value,
				...offsets(member.key.span.range),
				target,
			});
		this.typeString(members);
		const item = members.find(m => TYPE_STRING_KEYS.has(m.key.value))?.value;
		const names =
			item?.kind === "LiteralValue" && typeof item.value === "string"
				? item.value.split("|").map(n => n.trim())
				: undefined;
		for (const member of members) {
			if (member.value.kind !== "ObjectValue") continue;
			if (member.key.value === "variants") {
				for (const scene of member.value.members) {
					if (scene.value.kind !== "ObjectValue") continue;
					for (const m of scene.value.members)
						this.push({
							kind: "metaKey",
							name: m.key.value,
							...offsets(m.key.span.range),
							target,
						});
				}
			} else if (member.key.value === "item_meta") {
				if (names === undefined || names.length < 2) {
					this.meta(
						member.value.members,
						names === undefined
							? "object"
							: this.nameTarget(names[0] === "tuple" ? undefined : names[0])
					);
					continue;
				}
				for (const branch of member.value.members) {
					if (names.includes(branch.key.value) && branch.value.kind === "ObjectValue")
						this.meta(branch.value.members, this.nameTarget(branch.key.value));
				}
			}
		}
	}

	entry(entry: Entry, top: boolean, enumBody: boolean): void {
		for (const marker of entry.markers)
			this.push({ kind: "marker", name: marker.name, ...offsets(marker.span.range) });
		const key = offsets(entry.key.span.range);
		if (top) this.push({ kind: "declaration", name: entry.key.name, ...key, entry });
		else if (!enumBody) this.push({ kind: "field", name: entry.key.name, ...key, entry });
		if (entry.component !== undefined)
			this.nameRef(entry.component.name, ...spanOf(entry.component.span.range));
		if (entry.meta !== undefined) {
			const target = enumBody ? undefined : metaTarget(entry, this.declared);
			this.meta(entry.meta.members, target);
		}
		const childEnum = entry.component?.name === "enum";
		for (const child of entry.body?.entries ?? []) this.entry(child, false, childEnum);
	}
}

function spanOf(range: { start: { offset: number }; end: { offset: number } }): [number, number] {
	return [range.start.offset, range.end.offset];
}

/** 按源码顺序返回全部出现位置. */
export function collectOccurrences(file: JotlFile): Occurrence[] {
	const collector = new Collector(declaredTypeNames(file));
	for (const entry of file.entries) collector.entry(entry, true, false);
	return collector.occurrences.sort((a, b) => a.start - b.start);
}

/** 光标严格落在记号内的优先; 都不满足时接受光标紧贴记号末尾, 使输入完一个词后仍可跳转. */
export function occurrenceAt(
	occurrences: readonly Occurrence[],
	offset: number
): Occurrence | undefined {
	const inside = occurrences.filter(o => o.start <= offset && offset < o.end);
	const candidates =
		inside.length > 0 ? inside : occurrences.filter(o => o.end === offset && o.start < offset);
	return candidates.reduce<Occurrence | undefined>(
		(best, o) => (best === undefined || o.end - o.start < best.end - best.start ? o : best),
		undefined
	);
}

/** 同名声明重复时编译器取第一个, 跳转也取第一个. */
export function findDeclaration(
	occurrences: readonly Occurrence[],
	name: string
): Occurrence | undefined {
	return occurrences.find(o => o.kind === "declaration" && o.name === name);
}
