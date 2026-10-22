// 浏览器冒烟: 按浏览器平台打包 `@jotl/convert/from-ts`, 在不含 Node 全局(process, require, Buffer)的 vm 上下文里运行 tsToSchema.
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const ENTRY = fileURLToPath(new URL("../../src/from-ts.ts", import.meta.url));

interface BundleExports {
	tsToSchema(source: string): {
		value?: { $defs?: Record<string, unknown> };
		diagnostics: { code: string }[];
	};
}

async function loadBundle(): Promise<BundleExports> {
	const result = await build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "jotlFromTs",
		write: false,
		logLevel: "silent",
	});
	const context = createContext({ console });
	runInContext(result.outputFiles[0]!.text, context);
	return context.jotlFromTs as BundleExports;
}

describe("tsToSchema 浏览器打包", () => {
	it("无 Node 全局时可转换, 语法错误照常报 JOTL2101", { timeout: 60_000 }, async () => {
		const { tsToSchema } = await loadBundle();
		const ok = tsToSchema(
			"export interface T {\n\t/** @minLength 1 */\n\tname: string;\n\tage?: number;\n}\n"
		);
		expect(ok.diagnostics).toEqual([]);
		expect(ok.value?.$defs?.T).toMatchObject({
			type: "object",
			properties: { name: { type: "string", minLength: 1 }, age: { type: "number" } },
			required: ["name"],
		});
		const bad = tsToSchema("export interface T {");
		expect(bad.diagnostics.map(d => d.code)).toContain("JOTL2101");
	});
});
