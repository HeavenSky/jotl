// 嵌套 `$defs` 提升: 打印成 Jotl 与生成 TS 前把根资源内非根节点上的 `$defs` 条目移到根 `$defs`(规范化规则 2), 并改写指向它们的 `$ref`.
// 输出 JSON 的路径(如版本升级)不调用: 嵌套 `$defs` 在 JSON 中保留原位即可.
import { type JsonSchema, SUBSCHEMA_KEYWORDS, isSchemaObject } from "./json-schema.js";
import { type JsonPointer, appendPointer, formatPointer } from "./json-pointer.js";

type Raw = Record<string, unknown>;
type Container = Raw | unknown[];

export interface HoistedDefs {
	/** 提升后的文档; 没有可提升的条目时为输入本身. 输入不被修改, 未改动的子树与输入共享. */
	schema: JsonSchema;
	/** 提升出的条目: 新位置 `/$defs/<名字>` → 输入中的原位置, 按原位置的先序排列. */
	moved: ReadonlyMap<JsonPointer, JsonPointer>;
}

/** 与位置有关的动态引用: 搬动 schema 可能改变其解析, 出现时整份文档不提升. */
const DYNAMIC_KEYWORDS = ["$dynamicRef", "$dynamicAnchor", "$recursiveRef", "$recursiveAnchor"];

/** 在 URI 片段中需要编码的字符; 新名字中替换为 `_`, 使改写出的引用不必编码. */
const URI_UNSAFE = /[%#\s"<>\\^`{|}\p{Cc}]/gu;

interface Site {
	node: Raw;
	tokens: string[];
	/** 在根资源内: 从根到此不经过带 `$id` 的非根节点. */
	inRoot: boolean;
}

interface Scan {
	/** 根资源内非根节点上的 `$defs` 条目(原位置片段与键), 先序. */
	entries: { tokens: string[]; key: string }[];
	/** 根资源内带 `$ref` 的节点. */
	refs: Site[];
	/** 带 `$id` 的非根节点(内嵌资源), 先序. */
	resources: string[][];
	/** 无法安全提升: 动态引用, 根带 `$id` 时的非片段引用(可能指回本文档), 共享或成环的节点. */
	blocked: boolean;
}

/** 子 schema 位置的子节点, 按文档顺序. */
function childSchemas(node: Raw): [string[], unknown][] {
	const out: [string[], unknown][] = [];
	for (const [key, value] of Object.entries(node)) {
		if ((SUBSCHEMA_KEYWORDS.single as readonly string[]).includes(key))
			out.push([[key], value]);
		else if ((SUBSCHEMA_KEYWORDS.array as readonly string[]).includes(key)) {
			if (Array.isArray(value)) value.forEach((v, i) => out.push([[key, String(i)], v]));
		} else if ((SUBSCHEMA_KEYWORDS.map as readonly string[]).includes(key)) {
			if (isSchemaObject(value))
				for (const [k, v] of Object.entries(value)) out.push([[key, k], v]);
		}
	}
	return out;
}

/** 先序迭代遍历子 schema 位置, 极深的输入不会耗尽调用栈; 数据位置(default const 等)不进入. */
function scan(root: Raw): Scan {
	const out: Scan = { entries: [], refs: [], resources: [], blocked: false };
	const rootId = typeof root.$id === "string" ? root.$id : undefined;
	const seen = new Set<object>();
	const stack: Site[] = [{ node: root, tokens: [], inRoot: true }];
	while (stack.length > 0) {
		const site = stack.pop()!;
		const { node, tokens } = site;
		if (seen.has(node)) {
			out.blocked = true;
			continue;
		}
		seen.add(node);
		const isResource = tokens.length > 0 && Object.hasOwn(node, "$id");
		if (isResource) out.resources.push(tokens);
		const inRoot = site.inRoot && !isResource;
		if (DYNAMIC_KEYWORDS.some(k => Object.hasOwn(node, k))) out.blocked = true;
		const ref = node.$ref;
		if (typeof ref === "string") {
			if (!ref.startsWith("#")) {
				// 根带 `$id` 时非片段引用可能经该 URI 指回本文档的任意位置.
				if (rootId !== undefined) out.blocked = true;
			} else if (inRoot) out.refs.push({ node, tokens, inRoot });
		}
		if (inRoot && tokens.length > 0 && isSchemaObject(node.$defs)) {
			for (const key of Object.keys(node.$defs))
				out.entries.push({ tokens: [...tokens, "$defs", key], key });
		}
		const children = childSchemas(node);
		for (let i = children.length - 1; i >= 0; i--) {
			const [path, child] = children[i]!;
			if (isSchemaObject(child))
				stack.push({ node: child as Raw, tokens: [...tokens, ...path], inRoot });
		}
	}
	return out;
}

/** `#` 后为 JSON Pointer 的引用拆成原样片段与解码后的片段; 锚点, 无法解码或含编码的 `/` 时为 undefined. */
function refTokens(ref: string): { raw: string[]; decoded: string[] } | undefined {
	const fragment = ref.slice(1);
	if (!fragment.startsWith("/") || /%2f/i.test(fragment)) return undefined;
	const raw = fragment.slice(1).split("/");
	const decoded: string[] = [];
	for (const token of raw) {
		let text: string;
		try {
			text = decodeURIComponent(token);
		} catch {
			return undefined;
		}
		if (/~(?![01])/.test(text)) return undefined;
		decoded.push(text.replace(/~1/g, "/").replace(/~0/g, "~"));
	}
	return { raw, decoded };
}

function startsWith(tokens: readonly string[], prefix: readonly string[]): boolean {
	return prefix.length <= tokens.length && prefix.every((t, i) => tokens[i] === t);
}

function uniqueName(base: string, taken: ReadonlySet<string>): string {
	if (!taken.has(base)) return base;
	let i = 2;
	while (taken.has(`${base}${i}`)) i++;
	return `${base}${i}`;
}

/** 写时复制: 沿路径浅拷贝尚未拷贝的容器, 返回路径末端的(已拷贝)容器. */
class CopyOnWrite {
	private readonly copies = new Set<object>();
	readonly root: Raw;

	constructor(root: Raw) {
		this.root = { ...root };
		this.copies.add(this.root);
	}

	at(tokens: readonly string[]): Container {
		let current: Container = this.root;
		for (const token of tokens) {
			const holder = current as Raw;
			const child = holder[token] as Container;
			if (this.copies.has(child)) {
				current = child;
				continue;
			}
			const copy: Container = Array.isArray(child) ? [...child] : { ...child };
			this.copies.add(copy);
			holder[token] = copy;
			current = copy;
		}
		return current;
	}
}

/**
 * 把根资源内(从根到该节点不经过带 `$id` 的非根节点)非根节点上的 `$defs` 条目移到根 `$defs`, 名字沿用键(URI 片段中需要编码的字符换为 `_`), 重名时取 `<键>2` `<键>3`...;
 * 根资源内指向这些条目或其内部的 `#/...` 引用随之改指. 内嵌资源(带 `$id` 的子 schema)中的 `$defs` 与引用相对该资源解析, 不提升也不改写;
 * 内嵌资源整体可随所在条目移动. 文档含 `$dynamicRef` 等动态引用, 根带 `$id` 且有非片段引用(可能经该 URI 指回本文档), 或节点共享, 成环时不提升.
 * 新名字也避开根 `x-ui.widgets` 的键(打印时登记为扩展组件).
 */
export function hoistDefs(schema: JsonSchema): HoistedDefs {
	const unchanged: HoistedDefs = { schema, moved: new Map() };
	if (!isSchemaObject(schema)) return unchanged;
	const root = schema as Raw;
	if (Object.hasOwn(root, "$defs") && !isSchemaObject(root.$defs)) return unchanged;
	const found = scan(root);
	if (found.blocked || found.entries.length === 0) return unchanged;

	const taken = new Set(Object.keys((root.$defs as Raw | undefined) ?? {}));
	const xUi = root["x-ui"];
	if (isSchemaObject(xUi) && isSchemaObject((xUi as Raw).widgets))
		for (const name of Object.keys((xUi as Raw).widgets as Raw)) taken.add(name);
	const targets = found.entries.map(e => {
		const name = uniqueName(e.key.replace(URI_UNSAFE, "_"), taken);
		taken.add(name);
		return { tokens: e.tokens, name };
	});

	const doc = new CopyOnWrite(root);
	for (const site of found.refs) {
		const ref = site.node.$ref as string;
		const parsed = refTokens(ref);
		if (parsed === undefined) continue;
		// 嵌套的条目更长, 取最长的前缀.
		let best: (typeof targets)[number] | undefined;
		for (const t of targets) {
			if (
				startsWith(parsed.decoded, t.tokens) &&
				(best === undefined || t.tokens.length > best.tokens.length)
			)
				best = t;
		}
		if (best === undefined) continue;
		const rest = parsed.raw
			.slice(best.tokens.length)
			.map(t => `/${t}`)
			.join("");
		(doc.at(site.tokens) as Raw).$ref = `#${appendPointer("/$defs", best.name)}${rest}`;
	}

	// 按所在节点分组; 内层节点先取出条目并删掉其 `$defs`, 外层条目取出时已不含它们.
	const owners = new Map<string, { tokens: string[]; targets: typeof targets }>();
	found.entries.forEach((e, i) => {
		const tokens = e.tokens.slice(0, -2);
		const key = formatPointer(tokens);
		const group = owners.get(key) ?? { tokens, targets: [] };
		group.targets.push(targets[i]!);
		owners.set(key, group);
	});
	const hoisted = new Map<string, unknown>();
	for (const { tokens, targets: own } of [...owners.values()].reverse()) {
		const owner = doc.at(tokens) as Raw;
		const defs = owner.$defs as Raw;
		for (const t of own) hoisted.set(t.name, defs[t.tokens[t.tokens.length - 1]!]);
		delete owner.$defs;
	}
	const rootDefs: Raw = isSchemaObject(root.$defs) ? (doc.at(["$defs"]) as Raw) : {};
	for (const t of targets) rootDefs[t.name] = hoisted.get(t.name);
	doc.root.$defs = rootDefs;
	return {
		schema: doc.root as JsonSchema,
		moved: new Map(
			targets.map(t => [appendPointer("/$defs", t.name), formatPointer(t.tokens)])
		),
	};
}

/** 把提升后文档中的指针换回输入中的原位置; 不在提升出的条目内时原样返回. */
export function restorePointer(
	moved: ReadonlyMap<JsonPointer, JsonPointer>,
	pointer: JsonPointer
): JsonPointer {
	for (const [to, from] of moved) {
		if (pointer === to || pointer.startsWith(`${to}/`)) return from + pointer.slice(to.length);
	}
	return pointer;
}

/** 内嵌资源(带 `$id` 的非根子 schema)的位置, 先序; 其中的 `#...` 引用相对该资源解析, 不指向根 `$defs`. */
export function embeddedResources(schema: JsonSchema): JsonPointer[] {
	if (!isSchemaObject(schema)) return [];
	return scan(schema as Raw).resources.map(t => formatPointer(t));
}
