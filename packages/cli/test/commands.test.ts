// 端到端: 每个子命令以共享样例与本包样例为输入, 断言 stdout, stderr 诊断与退出码.
import { getDefaults } from "@jotl/data";
import { migrateFengdie } from "@jotl/convert";
import { compile, format } from "@jotl/core";
import { schemaToTs } from "@jotl/convert";
import { describe, expect, it } from "vitest";
import { readFixture, sortByKey } from "../../../test-utils/fixtures.js";
import {
	CLI_FIXTURES,
	SHARED_FIXTURES,
	cli,
	codesOf,
	diagnosticLines,
	readRepoFile,
	written,
} from "./helpers.js";

const F002 = `${SHARED_FIXTURES}/002-constraints`;
const F016 = `${SHARED_FIXTURES}/016-errors`;
const fixture002 = readFixture("002-constraints");
// 002 的约束在 TS 中无法往返(样例跳过 types.d.ts), 涉及 types.d.ts 的用例改用 001.
const F001 = `${SHARED_FIXTURES}/001-primitives`;
const fixture001 = readFixture("001-primitives");
const fixture016 = readFixture("016-errors");
// 111 的默认导出(`<default/>`)与根不同.
const F111 = `${SHARED_FIXTURES}/111-markers-conditions`;
const fixture111 = readFixture("111-markers-conditions");

describe("compile", () => {
	it("默认输出与样例深度相等的 JSON Schema", () => {
		const r = cli(["compile", `${F002}/source.jotl`]);
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
		expect(JSON.parse(r.stdout)).toEqual(fixture002.schema);
		expect(r.stdout.endsWith("}\n")).toBe(true);
	});

	it("--to ts 输出与样例 types.d.ts 逐字相等", () => {
		const r = cli(["compile", `${F001}/source.jotl`, "--to", "ts"]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(fixture001.types);
	});

	it("--to ts 按 `<default/>` 默认导出, 与根不同时根类型写 @root", () => {
		const r = cli(["compile", `${F111}/source.jotl`, "--to", "ts"]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(fixture111.types);
	});

	it("--typia-tags 输出 typia 类型标签", () => {
		const r = cli(["compile", `${F002}/source.jotl`, "--to=ts", "--typia-tags"]);
		const expected = schemaToTs(fixture002.schema as never, { typiaTags: true }).value;
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(expected);
		expect(r.stdout).toContain("tags.");
	});

	it("有错误级诊断时按 文件:行:列 代码 输出到 stderr, 退出码 1, 不输出结果", () => {
		const file = `${F016}/source.jotl`;
		const r = cli(["compile", file]);
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		const actual = diagnosticLines(r.stderr).map(d => {
			const [, line, column] = /:(\d+):(\d+)$/.exec(d.location) ?? [];
			expect(d.location.startsWith(`${file}:`)).toBe(true);
			expect(d.severity).toBe("错误");
			return { code: d.code, line: Number(line), column: Number(column) };
		});
		expect(sortByKey(actual)).toEqual(sortByKey(fixture016.diagnostics ?? []));
	});
});

describe("convert", () => {
	it("JSON Schema → Jotl: 再编译得到同一 schema", () => {
		const r = cli(["convert", `${F002}/schema.json`, "--to", "jotl"]);
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
		expect(compile(r.stdout, "out.jotl").value?.schema).toEqual(fixture002.schema);
	});

	it("TS → JSON Schema 与样例深度相等", () => {
		const r = cli(["convert", `${F001}/types.d.ts`, "--to", "schema"]);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual(fixture001.schema);
	});

	it("Jotl → TS 与样例逐字相等", () => {
		const r = cli(["convert", `${F001}/source.jotl`, "--to", "ts"]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(fixture001.types);
		expect(cli(["convert", `${F111}/source.jotl`, "--to", "ts"]).stdout).toBe(fixture111.types);
	});

	it("TS → Jotl 保留默认导出: 与根不同时写 <default/>", () => {
		const source =
			"export type A = string;\n/** @root */\nexport interface B { a: A }\nexport default A;\n";
		const r = cli(["convert", "mem/types.ts", "--to", "jotl"], {
			files: { "mem/types.ts": source },
		});
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("<default/>\nA: string");
		expect(compile(r.stdout, "out.jotl").value?.defaultExport).toBe("A");
	});

	it("升级冲突默认按声明版本处理, --on-conflict error 时报错", () => {
		const ok = cli(["convert", `${CLI_FIXTURES}/conflict-defs.json`, "--to", "schema"]);
		expect(ok.code).toBe(0);
		expect(diagnosticLines(ok.stderr).find(d => d.code === "JOTL3301")?.severity).toBe("警告");
		const strict = cli([
			"convert",
			`${CLI_FIXTURES}/conflict-defs.json`,
			"--to",
			"schema",
			"--on-conflict",
			"error",
		]);
		expect(strict.code).toBe(1);
	});

	it("--from 覆盖扩展名判断", () => {
		const r = cli(["convert", "mem/source.txt", "--from", "jotl", "--to", "schema"], {
			files: { "mem/source.txt": fixture002.source ?? "" },
		});
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual(fixture002.schema);
	});

	it("- 不写 --from 时按内容判断 JSON Schema, TS 或 Jotl, 判断不出时报 JOTL9016", () => {
		const json = cli(["convert", "-", "--to", "jotl"], {
			stdin: `\uFEFF \n${readRepoFile(`${F002}/schema.json`)}`,
		});
		expect(json.code).toBe(0);
		expect(compile(json.stdout, "out.jotl").value?.schema).toEqual(fixture002.schema);
		const ts = cli(["convert", "-", "--to", "schema"], {
			stdin: readRepoFile(`${F001}/types.d.ts`),
		});
		expect(ts.code).toBe(0);
		expect(JSON.parse(ts.stdout)).toEqual(fixture001.schema);
		const jotl = cli(["convert", "-", "--to", "schema"], {
			stdin: `/* 注释 */\n${fixture002.source ?? ""}`,
		});
		expect(jotl.code).toBe(0);
		expect(JSON.parse(jotl.stdout)).toEqual(fixture002.schema);
		const unknown = cli(["convert", "-", "--to", "schema"], { stdin: "foo bar" });
		expect(unknown.code).toBe(2);
		expect(unknown.stderr).toContain("JOTL9016");
		const forced = cli(["convert", "-", "--from", "jotl", "--to", "schema"], {
			stdin: fixture002.source ?? "",
		});
		expect(forced.code).toBe(0);
	});

	it("旧版 JSON Schema 先升级到 2020-12, 变更清单不输出", () => {
		const r = cli(["convert", `${CLI_FIXTURES}/legacy-draft-04.json`, "--to", "schema"]);
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
		const schema = JSON.parse(r.stdout) as Record<string, unknown>;
		expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
		expect(schema.$defs).toEqual({ Count: { type: "integer", exclusiveMinimum: 0 } });
	});

	it("目标格式无法表达的 schema 报诊断并以退出码 1 结束", () => {
		const r = cli(["convert", "mem/root.json", "--to", "ts"], {
			files: { "mem/root.json": "true" },
		});
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		expect(diagnosticLines(r.stderr).map(d => `${d.location} ${d.code}`)).toEqual([
			"mem/root.json# JOTL9053",
			"mem/root.json# JOTL2001",
		]);
	});
});

describe("check", () => {
	it("三种格式的正确输入: 无输出, 退出码 0", () => {
		const r = cli([
			"check",
			`${F002}/source.jotl`,
			`${F002}/schema.json`,
			`${F001}/types.d.ts`,
			`${CLI_FIXTURES}/legacy-draft-04.json`,
		]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe("");
		expect(r.stderr).toBe("");
	});

	it("Jotl 编译错误: 退出码 1, 其余文件照常检查", () => {
		const r = cli(["check", `${F016}/source.jotl`, `${CLI_FIXTURES}/newer-keyword.json`]);
		expect(r.code).toBe(1);
		const codes = codesOf(r.stderr);
		expect(codes.filter(c => c.startsWith("JOTL1"))).toHaveLength(
			fixture016.diagnostics?.length ?? -1
		);
		expect(codes).toContain("JOTL3201");
	});

	it("升级警告不影响退出码, 变更清单(提示)不输出", () => {
		const r = cli(["check", `${CLI_FIXTURES}/newer-keyword.json`]);
		expect(r.code).toBe(0);
		expect(diagnosticLines(r.stderr)).toEqual([
			expect.objectContaining({
				location: `${CLI_FIXTURES}/newer-keyword.json#/properties/kind/const`,
				code: "JOTL3201",
				severity: "警告",
			}),
		]);
	});

	it("升级冲突与无法用于校验的 schema 都是错误", () => {
		const r = cli([
			"check",
			`${CLI_FIXTURES}/conflict-defs.json`,
			`${CLI_FIXTURES}/unusable.json`,
		]);
		expect(r.code).toBe(1);
		expect(codesOf(r.stderr)).toEqual(["JOTL3201", "JOTL3301", "JOTL4017"]);
	});

	it("- 从 stdin 读入, 按内容判断 Jotl 或 JSON Schema; - 只能出现一次", () => {
		const jotl = cli(["check", "-"], { stdin: readRepoFile(`${F016}/source.jotl`) });
		expect(jotl.code).toBe(1);
		expect(codesOf(jotl.stderr).every(c => c.startsWith("JOTL1"))).toBe(true);
		expect(diagnosticLines(jotl.stderr)[0]?.location).toMatch(/^-:\d+:\d+$/);
		const json = cli(["check", "-"], {
			stdin: `\uFEFF \n${readRepoFile(`${CLI_FIXTURES}/unusable.json`)}`,
		});
		expect(json.code).toBe(1);
		expect(codesOf(json.stderr)).toEqual(["JOTL4017"]);
		const twice = cli(["check", "-", "-"], { stdin: "" });
		expect(twice.code).toBe(2);
		expect(codesOf(twice.stderr)).toEqual(["JOTL9015"]);
	});

	it("JSON 语法错误带行列", () => {
		const r = cli(["check", `${CLI_FIXTURES}/broken.json`]);
		expect(r.code).toBe(1);
		expect(diagnosticLines(r.stderr)).toEqual([
			expect.objectContaining({
				location: `${CLI_FIXTURES}/broken.json:4:1`,
				code: "JOTL9052",
			}),
		]);
	});

	it("未声明 $schema 且无法推断时按 2020-12 处理并警告", () => {
		const r = cli(["check", `${CLI_FIXTURES}/no-dialect.json`]);
		expect(r.code).toBe(0);
		expect(codesOf(r.stderr)).toEqual(["JOTL9053"]);
	});

	it("文件不存在: JOTL9050, 退出码 1", () => {
		const r = cli(["check", "mem/missing.jotl"]);
		expect(r.code).toBe(1);
		expect(diagnosticLines(r.stderr)).toEqual([
			expect.objectContaining({
				location: "mem/missing.jotl",
				code: "JOTL9050",
				message: expect.stringContaining("文件不存在"),
			}),
		]);
	});
});

describe("validate", () => {
	const validFiles = fixture002.valid.map(c => `${F002}/valid/${c.name}.json`);

	it.each(["source.jotl", "schema.json"])("schema 为 %s 时有效数据全部通过", schemaFile => {
		const r = cli(["validate", `${F002}/${schemaFile}`, ...validFiles]);
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
		expect(r.stdout).toBe(validFiles.map(f => `${f}: 通过\n`).join(""));
	});

	it("无效数据: 每个文件的错误代码与指针与样例一致, 退出码 1", () => {
		const cases = fixture002.invalid;
		const files = cases.map(c => `${F002}/invalid/${c.name}.json`);
		const r = cli(["validate", `${F002}/source.jotl`, ...files]);
		expect(r.code).toBe(1);
		expect(r.stdout).toBe(files.map(f => `${f}: 未通过\n`).join(""));
		const lines = diagnosticLines(r.stderr);
		for (const [i, c] of cases.entries()) {
			const prefix = `${files[i]}#`;
			const actual = lines
				.filter(d => d.location.startsWith(prefix))
				.map(d => ({ code: d.code, pointer: d.location.slice(prefix.length) }));
			expect(sortByKey(actual), c.name).toEqual(sortByKey(c.errors ?? []));
		}
	});

	it("数据文件不是合法 JSON 时报告并继续校验其余文件", () => {
		const r = cli([
			"validate",
			`${F002}/schema.json`,
			`${CLI_FIXTURES}/broken.json`,
			validFiles[0] ?? "",
		]);
		expect(r.code).toBe(1);
		expect(codesOf(r.stderr)).toEqual(["JOTL9052"]);
		expect(r.stdout).toBe(`${validFiles[0]}: 通过\n`);
	});

	it("schema 无法用于校验时报在 schema 文件上", () => {
		const r = cli(["validate", `${CLI_FIXTURES}/unusable.json`, validFiles[0] ?? ""]);
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		expect(diagnosticLines(r.stderr)).toEqual([
			expect.objectContaining({
				location: `${CLI_FIXTURES}/unusable.json`,
				code: "JOTL4017",
			}),
		]);
		expect(diagnosticLines(r.stderr)[0]?.message).not.toContain("schema is invalid");
		expect(r.stderr).toContain(`\n  ${CLI_FIXTURES}/unusable.json# schema is invalid`);
	});

	it("数据文件为 - 时从 stdin 读入", () => {
		const r = cli(["validate", `${F002}/schema.json`, "-"], {
			stdin: readRepoFile(validFiles[0] ?? ""),
		});
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
		expect(r.stdout).toBe("-: 通过\n");
	});

	it.each(["source.jotl", "schema.json"])(
		"schema 为 - 时从 stdin 读入 %s 并按内容判断格式",
		schemaFile => {
			const r = cli(["validate", "-", validFiles[0] ?? ""], {
				stdin: readRepoFile(`${F002}/${schemaFile}`),
			});
			expect(r.code).toBe(0);
			expect(r.stderr).toBe("");
			expect(r.stdout).toBe(`${validFiles[0]}: 通过\n`);
		}
	);

	it("schema 与数据同时为 - 时报用法错误", () => {
		const r = cli(["validate", "-", "-"], { stdin: "{}" });
		expect(r.code).toBe(2);
		expect(r.stdout).toBe("");
		expect(codesOf(r.stderr)).toEqual(["JOTL9015"]);
	});

	it("数据错误另附数据文件中的行列", () => {
		const schema = JSON.stringify({
			$schema: "https://json-schema.org/draft/2020-12/schema",
			type: "object",
			properties: { list: { type: "array", items: { type: "string" } } },
			required: ["name"],
		});
		const files = {
			"tmp/s.json": schema,
			"tmp/d.json": '{\n  "list": [\n    "a", 2\n  ]\n}\n',
		};
		const r = cli(["validate", "tmp/s.json", "tmp/d.json"], { files });
		expect(r.code).toBe(1);
		expect(
			diagnosticLines(r.stderr)
				.map(d => d.location)
				.sort()
		).toEqual(["tmp/d.json#/list/1", "tmp/d.json#/name"]);
		expect(r.stderr).toContain("\n  tmp/d.json:3:10 数据所在位置");
		expect(r.stderr).toContain("\n  tmp/d.json:1:1 数据所在位置");
	});
});

describe("defaults", () => {
	it("schema 为 - 时从 stdin 读入并按内容判断格式", () => {
		for (const schemaFile of ["source.jotl", "schema.json"]) {
			const r = cli(["defaults", "-"], { stdin: readRepoFile(`${F002}/${schemaFile}`) });
			expect(r.code, schemaFile).toBe(0);
			expect(JSON.parse(r.stdout)).toEqual(fixture002.defaults);
		}
	});

	it.each([
		[F002, "source.jotl", fixture002],
		[F002, "schema.json", fixture002],
		[F001, "types.d.ts", fixture001],
	] as const)("schema 为 %s/%s 时与样例 defaults.json 相等", (dir, schemaFile, fixture) => {
		const r = cli(["defaults", `${dir}/${schemaFile}`]);
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
		expect(JSON.parse(r.stdout)).toEqual(fixture.defaults);
	});

	it("--strategy all 与 getDefaults 的结果一致", () => {
		const r = cli(["defaults", `${F002}/source.jotl`, "--strategy", "all"]);
		expect(r.code).toBe(0);
		const expected = getDefaults(fixture002.schema as never, { strategy: "all" }).value;
		expect(JSON.parse(r.stdout)).toEqual(expected);
		expect(JSON.parse(r.stdout)).not.toEqual(fixture002.defaults);
	});

	it("没有可生成的默认数据: 提示, 不输出, 退出码 0", () => {
		const r = cli(["defaults", `${CLI_FIXTURES}/no-dialect.json`]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe("");
		expect(diagnosticLines(r.stderr).map(d => [d.code, d.severity])).toEqual([
			["JOTL9053", "警告"],
			["JOTL9054", "提示"],
		]);
	});
});

describe("migrate-schema: 常规 JSON Schema", () => {
	it("--to schema 输出 2020-12 schema, 判定结果与变更清单以提示输出到 stderr", () => {
		const file = `${CLI_FIXTURES}/legacy-draft-04.json`;
		const r = cli(["migrate-schema", file, "--to", "schema"]);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual({
			$schema: "https://json-schema.org/draft/2020-12/schema",
			$id: "https://example.com/legacy",
			type: "object",
			$defs: { Count: { type: "integer", exclusiveMinimum: 0 } },
			properties: { count: { $ref: "#/$defs/Count" } },
		});
		const [detected, ...changes] = diagnosticLines(r.stderr);
		expect(detected).toEqual(
			expect.objectContaining({ location: file, code: "JOTL9055", severity: "提示" })
		);
		expect(detected!.message).toContain("常规 JSON Schema");
		expect(
			changes.every(d => d.severity === "提示" && d.location.startsWith(`${file}#/`))
		).toBe(true);
		expect(changes.map(d => d.code).sort()).toEqual([
			"JOTL3101",
			"JOTL3102",
			"JOTL3105",
			"JOTL3119",
			"JOTL3120",
		]);
	});

	it("默认输出 Jotl, 不输出变更清单", () => {
		const file = `${CLI_FIXTURES}/legacy-draft-04.json`;
		const r = cli(["migrate-schema", file]);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("count");
		expect(compile(r.stdout, "out.jotl").value).toBeDefined();
		expect(codesOf(r.stderr)).toEqual(["JOTL9055"]);
	});

	it("--to schema 冲突默认报错: 退出码 1, 不输出结果", () => {
		const r = cli(["migrate-schema", `${CLI_FIXTURES}/conflict-defs.json`, "--to", "schema"]);
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		expect(diagnosticLines(r.stderr).find(d => d.code === "JOTL3301")?.severity).toBe("错误");
	});

	it("输出 Jotl 时冲突默认按声明版本处理", () => {
		const r = cli(["migrate-schema", `${CLI_FIXTURES}/conflict-defs.json`]);
		expect(r.code).toBe(0);
		expect(diagnosticLines(r.stderr).find(d => d.code === "JOTL3301")?.severity).toBe("警告");
	});

	it("--on-conflict preferLatest: 冲突降为警告, related 缩进输出", () => {
		const r = cli([
			"migrate-schema",
			`${CLI_FIXTURES}/conflict-defs.json`,
			"--to",
			"schema",
			"--on-conflict",
			"preferLatest",
		]);
		expect(r.code).toBe(0);
		expect((JSON.parse(r.stdout) as { $defs: unknown }).$defs).toEqual({
			Name: { type: "integer" },
		});
		expect(diagnosticLines(r.stderr).find(d => d.code === "JOTL3301")?.severity).toBe("警告");
		expect(r.stderr).toContain(
			`\n  ${CLI_FIXTURES}/conflict-defs.json#/definitions/Name 已按 2020-12 处理\n`
		);
	});

	it("--accept-newer-keywords=false 移除声明版本中不存在的关键字", () => {
		const r = cli([
			"migrate-schema",
			`${CLI_FIXTURES}/newer-keyword.json`,
			"--to",
			"schema",
			"--accept-newer-keywords=false",
		]);
		expect(r.code).toBe(0);
		expect((JSON.parse(r.stdout) as { properties: unknown }).properties).toEqual({ kind: {} });
		expect(codesOf(r.stderr)).toContain("JOTL3202");
	});

	it("--schema-version 指定未声明 $schema 的 OpenAPI 3.0 Schema Object", () => {
		const r = cli(
			["migrate-schema", "mem/pet.json", "--to", "schema", "--schema-version", "openapi-3.0"],
			{ files: { "mem/pet.json": JSON.stringify({ type: "string", nullable: true }) } }
		);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toMatchObject({ type: ["string", "null"] });
		expect(codesOf(r.stderr)).not.toContain("JOTL9053");
	});

	it("以 { 开头但 JSON 语法错误: 按 JSON 报告语法错误, 退出码 1", () => {
		const r = cli(["migrate-schema", "mem/bad.json"], {
			files: { "mem/bad.json": '{"type": ' },
		});
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		expect(codesOf(r.stderr)).toEqual(["JOTL9055", "JOTL9052"]);
	});
});

describe("migrate-schema: 凤蝶", () => {
	const file = `${CLI_FIXTURES}/home.fengdie`;
	const umoFile = `${CLI_FIXTURES}/home.umo.json`;

	it("凤蝶源码: 输出 Jotl, 警告不影响退出码", () => {
		const r = cli(["migrate-schema", file]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(migrateFengdie(readRepoFile(file), file).jotl);
		expect(r.stdout).toContain("Root(首页): {");
		expect(diagnosticLines(r.stderr)).toEqual([
			expect.objectContaining({
				location: file,
				code: "JOTL9055",
				severity: "提示",
				message: expect.stringContaining("凤蝶源码"),
			}),
			expect.objectContaining({
				location: `${file}:5:21`,
				code: "JOTL8105",
				severity: "警告",
			}),
		]);
	});

	it("umo JSON: 与源码迁移结果相同, 诊断位置为 JSON 指针", () => {
		const r = cli(["migrate-schema", umoFile]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(cli(["migrate-schema", file]).stdout);
		expect(diagnosticLines(r.stderr)).toEqual([
			expect.objectContaining({
				location: umoFile,
				code: "JOTL9055",
				message: expect.stringContaining("umo JSON"),
			}),
			expect.objectContaining({
				location: `${umoFile}#/properties/share/meta/foo`,
				code: "JOTL8105",
			}),
		]);
	});

	it("--to schema 输出迁移得到的 2020-12 schema", () => {
		const r = cli(["migrate-schema", file, "--to", "schema"]);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual(migrateFengdie(readRepoFile(file), file).schema);
	});

	it("凤蝶语法错误: 退出码 1", () => {
		const r = cli(["migrate-schema", "mem/bad.fengdie"], {
			files: { "mem/bad.fengdie": "Object(首页) {\n  title: String[\n" },
		});
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		expect(codesOf(r.stderr)[1]).toMatch(/^JOTL80\d\d$/);
	});
});

describe("format", () => {
	const file = `${CLI_FIXTURES}/unformatted.jotl`;

	it("输出格式化结果, 保留注释", () => {
		const r = cli(["format", file]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(`Home(首页): {
  title(标题): string[maxLength: 20, default: "欢迎"]
  // 数量
  count?: integer
}
`);
		expect(r.stdout).toBe(format(readRepoFile(file), file).value);
	});

	it("--write 写回原文件, 不输出到 stdout", () => {
		const r = cli(["format", "mem/a.jotl", "--write"], {
			files: { "mem/a.jotl": readRepoFile(file) },
		});
		expect(r.code).toBe(0);
		expect(r.stdout).toBe("");
		expect(written(r, "mem/a.jotl")).toBe(format(readRepoFile(file), file).value);
	});

	it("--write 写回时保留原有的 BOM", () => {
		const r = cli(["format", "mem/bom.jotl", "--write"], {
			files: { "mem/bom.jotl": "\uFEFF" + readRepoFile(file) },
		});
		expect(r.code).toBe(0);
		expect(written(r, "mem/bom.jotl")).toBe("\uFEFF" + format(readRepoFile(file), file).value);
	});

	it("- 从 stdin 读入, 不能与 --write 一起使用", () => {
		const r = cli(["format", "-"], { stdin: readRepoFile(file) });
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(format(readRepoFile(file), file).value);
		const w = cli(["format", "-", "--write"], { stdin: readRepoFile(file) });
		expect(w.code).toBe(2);
		expect(codesOf(w.stderr)).toEqual(["JOTL9014"]);
	});

	it("--write 时内容已是格式化结果则不写文件", () => {
		const formatted = format(readRepoFile(file), file).value ?? "";
		const r = cli(["format", "mem/done.jotl", "--write"], {
			files: { "mem/done.jotl": formatted },
			failWrites: { "mem/done.jotl": "EACCES" },
		});
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
	});

	it("语法错误: 退出码 1, 不输出也不写回", () => {
		const source = readRepoFile(`${F016}/source.jotl`);
		const r = cli(["format", "mem/bad.jotl", "--write"], { files: { "mem/bad.jotl": source } });
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		expect(written(r, "mem/bad.jotl")).toBe(source);
		expect(codesOf(r.stderr)).toContain("JOTL1002");
	});
});

describe("jotl.config.json", () => {
	const DIR = `${CLI_FIXTURES}/project`;
	const CONFIG = JSON.stringify({ widgets: { ImagePicker: "url", "tag-list": "array" } });
	const SOURCE =
		"Page: { cover: ImagePicker, tags: array[array_item: 'string', widget: 'tag-list'] }\n";
	const files = { [`${DIR}/jotl.config.json`]: CONFIG, [`${DIR}/pages/home.jotl`]: SOURCE };
	const cover = (stdout: string) =>
		(JSON.parse(stdout) as { $defs: { Page: { properties: Record<string, unknown> } } }).$defs
			.Page.properties["cover"];

	it("compile 从源文件所在目录向上找到最近的配置, 按底层类型编译扩展组件", () => {
		const r = cli(["compile", `${DIR}/pages/home.jotl`], { files });
		expect(r.stderr).toBe("");
		expect(r.code).toBe(0);
		expect(cover(r.stdout)).toEqual({
			type: "string",
			format: "uri",
			"x-ui": { widget: "ImagePicker" },
		});
	});

	it("更近的配置优先; 不跨越 git 顶层", () => {
		const nearer = {
			...files,
			[`${DIR}/pages/jotl.config.json`]: JSON.stringify({
				widgets: { ImagePicker: "integer" },
			}),
		};
		expect(cover(cli(["compile", `${DIR}/pages/home.jotl`], { files: nearer }).stdout)).toEqual(
			{ type: "integer", "x-ui": { widget: "ImagePicker" } }
		);
		const r = cli(["check", `${DIR}/pages/home.jotl`], {
			files: { "../jotl.config.json": CONFIG, [`${DIR}/pages/home.jotl`]: SOURCE },
		});
		expect(codesOf(r.stderr)).toEqual(["JOTL1006"]);
	});

	it("check, convert, validate, defaults 同样读取; stdin 输入从当前目录查找", () => {
		expect(cli(["check", `${DIR}/pages/home.jotl`], { files }).code).toBe(0);
		expect(
			cover(cli(["convert", `${DIR}/pages/home.jotl`, "--to", "schema"], { files }).stdout)
		).toMatchObject({ format: "uri" });
		const data = {
			[`${DIR}/data.json`]: JSON.stringify({ cover: "https://a.b/c.png", tags: ["x"] }),
		};
		expect(
			cli(["validate", `${DIR}/pages/home.jotl`, `${DIR}/data.json`], {
				files: { ...files, ...data },
			}).code
		).toBe(0);
		expect(cli(["defaults", `${DIR}/pages/home.jotl`], { files }).code).toBe(0);
		expect(
			cli(["compile", "-"], { stdin: SOURCE, files: { "jotl.config.json": CONFIG } }).code
		).toBe(0);
	});

	it("--config 指定配置文件, --no-config 不读取", () => {
		const other = {
			[`${CLI_FIXTURES}/other.json`]: JSON.stringify({ widgets: { ImagePicker: "number" } }),
		};
		const r = cli(
			["compile", `${DIR}/pages/home.jotl`, "--config", `${CLI_FIXTURES}/other.json`],
			{ files: { ...files, ...other } }
		);
		expect(cover(r.stdout)).toEqual({ type: "number", "x-ui": { widget: "ImagePicker" } });
		expect(
			codesOf(cli(["check", `${DIR}/pages/home.jotl`, "--no-config"], { files }).stderr)
		).toEqual(["JOTL1006"]);
		const missing = cli(["check", `${DIR}/pages/home.jotl`, "--config", "nope.json"], {
			files,
		});
		expect(diagnosticLines(missing.stderr)).toEqual([
			{
				location: "nope.json",
				code: "JOTL9050",
				severity: "错误",
				message: "无法读取文件 `nope.json`: 文件不存在",
			},
		]);
	});

	it("配置不合法时报 JOTL9056(定位到配置文件中的键)或 JOTL9052, 不编译源文件, 同一配置只报一次", () => {
		const bad = {
			...files,
			[`${DIR}/jotl.config.json`]: '{\n  "widgets": { "ImagePicker": "enum" }\n}\n',
			[`${DIR}/pages/b.jotl`]: SOURCE,
		};
		const r = cli(["check", `${DIR}/pages/home.jotl`, `${DIR}/pages/b.jotl`], { files: bad });
		expect(r.code).toBe(1);
		const lines = diagnosticLines(r.stderr);
		expect(lines.map(l => [l.location, l.code])).toEqual([
			[`${DIR}/jotl.config.json:2:16`, "JOTL9056"],
		]);
		expect(lines[0]!.message).toContain("`enum`");
		const broken = cli(["compile", `${DIR}/pages/home.jotl`], {
			files: { ...files, [`${DIR}/jotl.config.json`]: "{" },
		});
		expect(codesOf(broken.stderr)).toEqual(["JOTL9052"]);
		expect(broken.stdout).toBe("");
	});

	it("非大驼峰 widget 名写了底层类型时只做兼容检查: 与字段类型不兼容报 JOTL1052 警告, 照常编译", () => {
		const config = {
			[`${DIR}/jotl.config.json`]: JSON.stringify({ widgets: { headline: "string" } }),
		};
		const source = {
			[`${DIR}/pages/count.jotl`]: "Page: {\n  count: integer[widget: 'headline']\n}\n",
		};
		const r = cli(["check", `${DIR}/pages/count.jotl`], { files: { ...config, ...source } });
		expect(r.code).toBe(0);
		expect(diagnosticLines(r.stderr)).toEqual([
			{
				location: `${DIR}/pages/count.jotl:2:26`,
				code: "JOTL1052",
				severity: "警告",
				message: "widget `headline` 声明的底层类型 `string` 与字段类型 `integer` 不兼容",
			},
		]);
		expect(
			codesOf(
				cli(["check", `${DIR}/pages/count.jotl`, "--no-config"], {
					files: { ...config, ...source },
				}).stderr
			)
		).toEqual([]);
	});

	it("JSON Schema 输入不读取配置", () => {
		const r = cli(["check", `${F002}/schema.json`], {
			files: { [`${F002}/jotl.config.json`]: "{" },
		});
		expect(r.code).toBe(0);
	});
});
