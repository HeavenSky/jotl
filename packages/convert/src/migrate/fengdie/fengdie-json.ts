// 凤蝶语法树 → fengdie JSON schema: 与凤蝶编辑器 `toJson`(`lib/schema.js`, 无 checkLevel, 无 options)同构, 另记录各节点的源码位置.
import type { Diagnostic, SourceRange } from "@jotl/core";
import type { FengdieDocument, Meta, Prop, RootSchema } from "./ast.js";
import { enumMemberPart, type MigrateDiagnosticCode, migrateDiagnostic } from "./diagnostics.js";
import {
	FENGDIE_JSON_CUSTOM_META_RE,
	FENGDIE_JSON_DEFAULT_TYPE,
	FENGDIE_JSON_MODULE_DIST,
	FENGDIE_JSON_TYPES,
	type FengdieJson,
	type FengdieJsonMetaValue,
	type FengdieJsonNode,
	fengdieJsonMetaKeys,
} from "./fengdie-json-types.js";

/** fengdie JSON schema 节点(含枚举成员)到源码位置: range 为字段名或类型关键字, meta 为各元数据项. */
export interface FengdieJsonOrigin {
	range: SourceRange;
	meta?: Map<string, SourceRange>;
}

export type FengdieJsonOrigins = WeakMap<object, FengdieJsonOrigin>;

export class FengdieJsonBuilder {
	readonly diagnostics: Diagnostic[] = [];
	readonly origins: FengdieJsonOrigins = new WeakMap();

	document(doc: FengdieDocument): FengdieJson {
		if (doc.kind === "schema") return this.root(doc.schema);
		const json: Record<string, FengdieJsonNode> = {};
		for (const { name, schema } of doc.exports) {
			if (Object.hasOwn(json, name.text))
				this.warn("JOTL8116", { name: name.text }, name.range);
			json[name.text] = this.root(schema);
		}
		return json;
	}

	private root(schema: RootSchema): FengdieJsonNode {
		const node: FengdieJsonNode = {
			type: schema.type,
			description: schema.label.text,
			properties: this.properties(schema.props),
		};
		this.origins.set(node, { range: schema.range });
		this.attachMeta(node, schema.type, schema.meta);
		if (schema.lottery) node.lottery = true;
		if (schema.publicRange !== undefined) node.public = true;
		return node;
	}

	private properties(props: readonly Prop[]): Record<string, FengdieJsonNode> {
		const properties: Record<string, FengdieJsonNode> = {};
		for (const prop of props) {
			const key = prop.key.text;
			if (Object.hasOwn(properties, key))
				this.warn("JOTL8109", { name: key }, prop.key.range);
			const node = this.prop(prop);
			this.origins.set(node, { range: prop.key.range });
			this.attachMeta(node, node.type, prop.meta);
			properties[key] = node;
		}
		return properties;
	}

	private prop(prop: Prop): FengdieJsonNode {
		const key = prop.key.text;
		const description = prop.label.text;
		switch (prop.kind) {
			case "enum":
				return {
					key,
					type: "enum",
					description,
					items: prop.items.map(item => this.enumItem(item)),
				};
			case "nested":
				return {
					key,
					type: prop.type,
					description,
					properties: this.properties(prop.props),
				};
			case "leaf":
				return { key, type: this.leafType(prop.path), description };
		}
	}

	private enumItem(item: Prop): { label: string; value: string } {
		const name = item.key.text;
		if (item.kind !== "leaf" || item.path.length > 0)
			this.warn("JOTL8112", { name, part: enumMemberPart("type") }, item.key.range);
		if (item.meta !== undefined)
			this.warn("JOTL8112", { name, part: enumMemberPart("meta") }, item.meta.range);
		const member = { label: item.label.text, value: name };
		this.origins.set(member, { range: item.key.range });
		return member;
	}

	/** getType: 取路径中第一段已知类型名(不区分大小写), 都不认识时为 `string`. */
	private leafType(path: readonly { text: string; range: SourceRange }[]): string {
		if (path.length === 0) return FENGDIE_JSON_DEFAULT_TYPE;
		for (const segment of path) {
			const type = segment.text.toLowerCase();
			if (FENGDIE_JSON_TYPES.has(type)) return type;
		}
		const first = path[0]!.range;
		const last = path[path.length - 1]!.range;
		this.warn(
			"JOTL8111",
			{ type: path.map(s => s.text).join(".") },
			{ file: first.file, start: first.start, end: last.end }
		);
		return FENGDIE_JSON_DEFAULT_TYPE;
	}

	/** _processMeta: 只保留该类型白名单内与 `custom*` 的元数据, 同名后者覆盖; module 类补 `dist`. */
	private attachMeta(node: FengdieJsonNode, type: string, meta: Meta | undefined): void {
		if (meta === undefined || meta.entries.length === 0) return;
		const allowed = fengdieJsonMetaKeys(type);
		const item: Record<string, FengdieJsonMetaValue> = {};
		const ranges = new Map<string, SourceRange>();
		for (const entry of meta.entries) {
			const key = entry.key.text;
			if (ranges.has(key)) this.warn("JOTL8110", { key }, entry.key.range);
			if (allowed?.includes(key) || FENGDIE_JSON_CUSTOM_META_RE.test(key)) {
				item[key] = entry.value;
				ranges.set(key, entry.range);
			} else if (allowed === undefined) {
				this.warn("JOTL8118", { type, key }, entry.key.range);
			} else {
				this.warn("JOTL8105", { key, type }, entry.key.range);
			}
		}
		if (type === "module" || type === "modulearray") item.dist = FENGDIE_JSON_MODULE_DIST;
		node.meta = item;
		this.origins.get(node)!.meta = ranges;
	}

	private warn(
		code: MigrateDiagnosticCode,
		params: Record<string, string>,
		range: SourceRange
	): void {
		this.diagnostics.push(
			migrateDiagnostic(code, params, { location: { kind: "source", range } })
		);
	}
}
