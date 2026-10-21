// 跨文件升级(V5): 经调用方的加载回调逐个取回 $ref 指向的文档, 各自识别版本与升级, 再按目标文档的指针映射改写引用.
import { type Diagnostic, type JsonSchema, type Result, fail, hasErrors, ok } from "@jotl/core";
import type { VersionSource } from "./detect.js";
import { upgradeDiagnostic } from "./diagnostics.js";
import { type ResourceLookup, rewriteRefs, walkRefTargets } from "./refs.js";
import { type DocumentState, locate } from "./transform.js";
import {
	type UpgradeOptions,
	type UpgradedSchema,
	finalizeDocument,
	prepareDocument,
} from "./upgrade.js";
import { resolveUri, splitFragment } from "./uri.js";

/**
 * 按绝对 URI 取回文档.
 * 返回 value 为 undefined 且没有 error 诊断时, 表示该文档不参与升级(例如校验器已内置的元 schema), 引用保持原样.
 */
export type DocumentLoader = (uri: string) => Result<unknown> | Promise<Result<unknown>>;

export interface UpgradeDocumentsOptions extends Omit<UpgradeOptions, "uri"> {
	load: DocumentLoader;
}

export interface UpgradedDocument extends UpgradedSchema {
	uri: string;
}

export interface UpgradedDocuments {
	entry: string;
	/** 键为文档 URI(不含片段), 按加载顺序排列, 第一项为入口. */
	documents: ReadonlyMap<string, UpgradedDocument>;
}

interface Loaded {
	state: DocumentState;
	source: VersionSource;
}

async function loadDocument(
	load: DocumentLoader,
	uri: string,
	referrer: Diagnostic["location"]
): Promise<Result<unknown>> {
	const extras = referrer === undefined ? {} : { location: referrer };
	try {
		const result = await load(uri);
		if (result.value === undefined && hasErrors(result.diagnostics)) {
			return fail([upgradeDiagnostic("JOTL3401", { uri }, extras), ...result.diagnostics]);
		}
		return result;
	} catch {
		return fail([upgradeDiagnostic("JOTL3402", { uri }, extras)]);
	}
}

/** 从入口文档开始升级它及其 $ref 可达的全部文档; 每个文档按自己的 `$schema` 或特征识别版本. */
export async function upgradeDocuments(
	entry: string,
	options: UpgradeDocumentsOptions
): Promise<Result<UpgradedDocuments>> {
	const { load, ...upgradeOptions } = options;
	const entryUri = splitFragment(entry).base;
	const loaded = new Map<string, Loaded>();
	const skipped = new Set<string>();
	const diagnostics: Diagnostic[] = [];
	// 该 URI 可能是稍后才加载的文档里嵌入的 $id 资源, 加载失败的诊断要等全部文档加载完再裁决.
	const pendingFailures = new Map<string, Diagnostic[]>();
	const queue: { uri: string; referrer: Diagnostic["location"] }[] = [
		{ uri: entryUri, referrer: undefined },
	];

	const lookup: ResourceLookup = uri => {
		for (const { state } of loaded.values()) {
			const resource = state.resources.get(uri);
			if (resource !== undefined) return { state, resource };
		}
		return undefined;
	};

	while (queue.length > 0) {
		const { uri, referrer } = queue.shift()!;
		if (loaded.has(uri) || skipped.has(uri) || lookup(uri) !== undefined) continue;
		const result = await loadDocument(load, uri, referrer);
		if (result.value === undefined) {
			skipped.add(uri);
			pendingFailures.set(uri, [...result.diagnostics]);
			continue;
		}
		const prepared = prepareDocument(result.value, { ...upgradeOptions, uri });
		diagnostics.push(...result.diagnostics);
		if (prepared.state === undefined || prepared.source === undefined) {
			skipped.add(uri);
			diagnostics.push(...prepared.diagnostics);
			continue;
		}
		loaded.set(uri, { state: prepared.state, source: prepared.source });
		for (const site of prepared.state.refSites) {
			const target = splitFragment(
				resolveUri(site.base, splitFragment(site.node[site.keyword] as string).base)
			).base;
			if (prepared.state.resources.has(target)) continue;
			queue.push({ uri: target, referrer: locate(site.oldPointer, uri) });
		}
	}
	for (const [uri, failure] of pendingFailures) {
		if (lookup(uri) === undefined) diagnostics.push(...failure);
	}

	walkRefTargets(
		[...loaded.values()].map(d => d.state),
		lookup
	);
	const documents = new Map<string, UpgradedDocument>();
	for (const [uri, { state, source }] of loaded) {
		rewriteRefs(state, lookup);
		const schema: JsonSchema = finalizeDocument(state);
		diagnostics.push(...state.diagnostics);
		documents.set(uri, { uri, schema, version: state.version, versionSource: source });
	}
	if (hasErrors(diagnostics)) return fail(diagnostics);
	return ok({ entry: entryUri, documents }, diagnostics);
}
