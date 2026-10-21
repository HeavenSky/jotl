import { JSON_SCHEMA_DIALECT, type Result, fail, ok, schemaDiagnostic } from "@jotl/core";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { upgradeDocuments, upgradeSchema } from "../../../src/migrate/upgrade/index.js";
import { codes, deepFreeze, find, pointerOf } from "./helpers.js";

const DOCS: Record<string, unknown> = deepFreeze({
	"https://x.test/main.json": {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		type: "object",
		properties: {
			name: { $ref: "common/defs.json#/definitions/name" },
			origin: { $ref: "shapes.json#/$defs/point/items/0" },
		},
	},
	"https://x.test/common/defs.json": {
		$schema: "http://json-schema.org/draft-07/schema#",
		definitions: { name: { type: "string", minLength: 1 } },
	},
	"https://x.test/shapes.json": {
		$schema: "https://json-schema.org/draft/2019-09/schema",
		$defs: {
			point: { items: [{ type: "number" }, { type: "number" }], additionalItems: false },
		},
	},
});

function loader(docs: Record<string, unknown>) {
	const calls: string[] = [];
	const load = async (uri: string): Promise<Result<unknown>> => {
		calls.push(uri);
		return ok(docs[uri]);
	};
	return { load, calls };
}

describe("V5: 跨文件 $ref 指向不同版本的文档", () => {
	it("按文档逐个识别与升级, 并按目标文档的改名换算引用", async () => {
		const { load, calls } = loader(DOCS);
		const result = await upgradeDocuments("https://x.test/main.json", { load });
		expect(calls).toEqual([
			"https://x.test/main.json",
			"https://x.test/common/defs.json",
			"https://x.test/shapes.json",
		]);
		const documents = result.value!.documents;
		expect([...documents.values()].map(d => [d.uri, d.version])).toEqual([
			["https://x.test/main.json", "2020-12"],
			["https://x.test/common/defs.json", "draft-07"],
			["https://x.test/shapes.json", "2019-09"],
		]);
		expect(documents.get("https://x.test/main.json")?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			type: "object",
			properties: {
				name: { $ref: "common/defs.json#/$defs/name" },
				origin: { $ref: "shapes.json#/$defs/point/prefixItems/0" },
			},
		});
		expect(documents.get("https://x.test/common/defs.json")?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$defs: { name: { type: "string", minLength: 1 } },
		});
		const rewrite = result.diagnostics.filter(d => d.code === "JOTL3120");
		expect(
			rewrite.map(d =>
				d.location?.kind === "pointer" ? [d.location.document, d.location.pointer] : []
			)
		).toEqual([
			["https://x.test/main.json", "/properties/name/$ref"],
			["https://x.test/main.json", "/properties/origin/$ref"],
		]);

		const ajv = new Ajv2020({ strict: false });
		for (const [uri, doc] of documents) ajv.addSchema(doc.schema as object, uri);
		const validate = ajv.getSchema(result.value!.entry)!;
		expect(validate({ name: "a", origin: 1 })).toBe(true);
		expect(validate({ name: "", origin: 1 })).toBe(false);
		expect(validate({ name: "a", origin: "x" })).toBe(false);
	});

	it("单文档升级时, 外部引用按引用方版本推算; 2020-12 的引用方不改写", () => {
		const result = upgradeSchema(DOCS["https://x.test/main.json"]);
		expect(codes(result.diagnostics)).not.toContain("JOTL3120");
		const legacy = upgradeSchema({
			$schema: "http://json-schema.org/draft-07/schema#",
			$ref: "other.json#/definitions/a",
		});
		expect(legacy.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$ref: "other.json#/$defs/a",
		});
	});

	it("循环引用的文档只加载一次", async () => {
		const { load, calls } = loader({
			"https://x.test/a.json": {
				$schema: "http://json-schema.org/draft-07/schema#",
				properties: { b: { $ref: "b.json" } },
			},
			"https://x.test/b.json": {
				$schema: "http://json-schema.org/draft-06/schema#",
				properties: { a: { $ref: "a.json#" } },
			},
		});
		const result = await upgradeDocuments("https://x.test/a.json", { load });
		expect(result.value?.documents.size).toBe(2);
		expect(calls).toEqual(["https://x.test/a.json", "https://x.test/b.json"]);
	});

	it("加载回调返回空值时跳过该文档, 引用保持原样", async () => {
		const { load } = loader({
			"https://x.test/a.json": {
				$schema: "http://json-schema.org/draft-07/schema#",
				$ref: "http://json-schema.org/draft-07/schema#",
			},
		});
		const result = await upgradeDocuments("https://x.test/a.json", { load });
		expect(result.value?.documents.size).toBe(1);
		expect(result.value?.documents.get("https://x.test/a.json")?.schema).toMatchObject({
			$ref: "http://json-schema.org/draft-07/schema#",
		});
	});

	it("加载失败与回调抛异常转为带引用位置的错误诊断", async () => {
		const entry = {
			$schema: "http://json-schema.org/draft-07/schema#",
			properties: { a: { $ref: "missing.json" }, b: { $ref: "boom.json" } },
		};
		const result = await upgradeDocuments("https://x.test/a.json", {
			load: uri => {
				if (uri.endsWith("a.json")) return ok(entry);
				if (uri.endsWith("boom.json")) throw new Error("internal");
				return fail([schemaDiagnostic("JOTL0002", { pointer: uri })]);
			},
		});
		expect(result.value).toBeUndefined();
		expect(codes(result.diagnostics)).toEqual(
			expect.arrayContaining(["JOTL3401", "JOTL0002", "JOTL3402"])
		);
		expect(pointerOf(find(result.diagnostics, "JOTL3401"))).toBe("/properties/a");
		expect(find(result.diagnostics, "JOTL3402")?.message).not.toContain("internal");
	});

	it("指向其他文档嵌入 $id 资源的引用先于该文档出现时, 加载失败的诊断在资源解析到后被丢弃; 真正缺失的仍报错", async () => {
		const docs: Record<string, unknown> = {
			"https://x.test/a.json": {
				$schema: "http://json-schema.org/draft-07/schema#",
				properties: {
					x: { $ref: "item.json" },
					y: { $ref: "b.json#/definitions/item" },
					z: { $ref: "missing.json" },
				},
			},
			"https://x.test/b.json": {
				$schema: "http://json-schema.org/draft-07/schema#",
				definitions: { item: { $id: "item.json", type: "string" } },
			},
		};
		const calls: string[] = [];
		const load = (uri: string): Result<unknown> => {
			calls.push(uri);
			if (uri in docs) return ok(docs[uri]);
			return fail([schemaDiagnostic("JOTL0002", { pointer: uri })]);
		};
		const failed = await upgradeDocuments("https://x.test/a.json", { load });
		expect(calls).toEqual([
			"https://x.test/a.json",
			"https://x.test/item.json",
			"https://x.test/b.json",
			"https://x.test/missing.json",
		]);
		expect(failed.value).toBeUndefined();
		const loadFailures = failed.diagnostics.filter(d => d.code === "JOTL3401");
		expect(loadFailures.map(d => d.message)).toEqual([
			expect.stringContaining("https://x.test/missing.json"),
		]);
		expect(pointerOf(loadFailures[0])).toBe("/properties/z");
		expect(failed.diagnostics.filter(d => d.code === "JOTL0002")).toHaveLength(1);

		docs["https://x.test/missing.json"] = {
			$schema: "http://json-schema.org/draft-07/schema#",
			type: "number",
		};
		const result = await upgradeDocuments("https://x.test/a.json", { load });
		expect(codes(result.diagnostics)).not.toContain("JOTL3401");
		expect(codes(result.diagnostics)).not.toContain("JOTL0002");
		const documents = result.value!.documents;
		expect([...documents.keys()]).toEqual([
			"https://x.test/a.json",
			"https://x.test/b.json",
			"https://x.test/missing.json",
		]);
		expect(documents.get("https://x.test/a.json")?.schema).toMatchObject({
			properties: { x: { $ref: "item.json" }, y: { $ref: "b.json#/$defs/item" } },
		});
		const ajv = new Ajv2020({ strict: false });
		for (const [uri, doc] of documents) ajv.addSchema(doc.schema as object, uri);
		const validate = ajv.getSchema(result.value!.entry)!;
		expect(validate({ x: "a", y: "b", z: 1 })).toBe(true);
		expect(validate({ x: 1 })).toBe(false);
	});

	it("被引用文档各自走自己的版本识别: 无法判定时报错并指明文档", async () => {
		const { load } = loader({
			"https://x.test/a.json": {
				$schema: "http://json-schema.org/draft-07/schema#",
				$ref: "b.json",
			},
			"https://x.test/b.json": { type: "string" },
		});
		const failed = await upgradeDocuments("https://x.test/a.json", { load });
		expect(failed.value).toBeUndefined();
		expect(find(failed.diagnostics, "JOTL3001")?.location).toEqual({
			kind: "pointer",
			pointer: "",
			document: "https://x.test/b.json",
		});
		const specified = await upgradeDocuments("https://x.test/a.json", {
			load,
			version: "draft-07",
		});
		expect(specified.value?.documents.get("https://x.test/b.json")?.version).toBe("draft-07");
	});
});
