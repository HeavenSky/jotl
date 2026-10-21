// 共享样例集(fixtures/)的读取工具, 供各包测试按相对路径导入.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 先把本文件 URL 转成路径再拼接: jsdom 环境下 Vite 会把 `new URL("../fixtures/", import.meta.url)` 改写成 http 地址.
export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export interface ExpectedError {
	code: string;
	pointer: string;
}

export interface ExpectedDiagnostic {
	code: string;
	line: number;
	column: number;
}

export interface FixtureMeta {
	covers: string[];
	skip?: string[];
}

export interface DataCase {
	name: string;
	data: unknown;
}

export interface InvalidDataCase extends DataCase {
	errors: ExpectedError[] | undefined;
}

export interface Fixture {
	name: string;
	dir: string;
	meta: FixtureMeta;
	source: string | undefined;
	schema: unknown;
	hasSchema: boolean;
	types: string | undefined;
	defaults: unknown;
	hasDefaults: boolean;
	valid: DataCase[];
	invalid: InvalidDataCase[];
	diagnostics: ExpectedDiagnostic[] | undefined;
}

function readText(path: string): string | undefined {
	return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function readCases(dir: string): DataCase[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter(f => f.endsWith(".json") && !f.endsWith(".errors.json"))
		.sort()
		.map(f => ({ name: f.slice(0, -".json".length), data: readJson(join(dir, f)) }));
}

/** 全部样例目录名, 按序号排序. */
export function listFixtures(): string[] {
	return readdirSync(FIXTURES_DIR, { withFileTypes: true })
		.filter(e => e.isDirectory() && /^\d{3}-/.test(e.name))
		.map(e => e.name)
		.sort();
}

export function readFixture(name: string): Fixture {
	const dir = join(FIXTURES_DIR, name);
	if (!existsSync(dir)) throw new Error(`样例不存在: ${name}`);
	const schemaPath = join(dir, "schema.json");
	const defaultsPath = join(dir, "defaults.json");
	const diagnosticsPath = join(dir, "diagnostics.json");
	const invalidDir = join(dir, "invalid");
	const meta = readJson(join(dir, "meta.json")) as FixtureMeta;
	return {
		name,
		dir,
		meta,
		source: readText(join(dir, "source.jotl")),
		schema: existsSync(schemaPath) ? readJson(schemaPath) : undefined,
		hasSchema: existsSync(schemaPath),
		// 统一为 LF, 期望文件按逐字比较.
		types: readText(join(dir, "types.d.ts"))?.replace(/\r\n/g, "\n"),
		defaults: existsSync(defaultsPath) ? readJson(defaultsPath) : undefined,
		hasDefaults: existsSync(defaultsPath),
		valid: readCases(join(dir, "valid")),
		invalid: readCases(invalidDir).map(c => {
			const errorsPath = join(invalidDir, `${c.name}.errors.json`);
			return {
				...c,
				errors: existsSync(errorsPath)
					? (readJson(errorsPath) as ExpectedError[])
					: undefined,
			};
		}),
		diagnostics: existsSync(diagnosticsPath)
			? (readJson(diagnosticsPath) as ExpectedDiagnostic[])
			: undefined,
	};
}

/** 样例的 meta.skip 是否声明跳过某个期望文件. */
export function isSkipped(fixture: Fixture, file: string): boolean {
	return fixture.meta.skip?.includes(file) ?? false;
}

/** 按集合相等比较期望项, 不比较顺序. */
export function sortByKey<T>(items: T[]): T[] {
	return [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
