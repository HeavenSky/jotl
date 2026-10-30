// 端到端: 帮助, 版本, 用法错误(退出码 2)与 --out 输出到文件.
import { describe, expect, it } from "vitest";
import { COMMAND_NAMES } from "../src/index.js";
import {
	CLI_FIXTURES,
	SHARED_FIXTURES,
	cli,
	diagnosticLines,
	readRepoFile,
	written,
} from "./helpers.js";

const SOURCE = `${SHARED_FIXTURES}/002-constraints/source.jotl`;
const VERSION = (JSON.parse(readRepoFile("packages/cli/package.json")) as { version: string })
	.version;

describe("帮助与版本", () => {
	it.each([["--help"], ["-h"], ["help"]])("%s 输出全局帮助到 stdout", flag => {
		const r = cli([flag]);
		expect(r.code).toBe(0);
		expect(r.stderr).toBe("");
		expect(r.stdout).toContain("用法: jotl <命令> [选项]");
		for (const name of COMMAND_NAMES) expect(r.stdout).toContain(`  ${name} `);
	});

	it.each(COMMAND_NAMES.map(name => [name]))("%s --help 输出该命令的帮助, 忽略其余参数", name => {
		const r = cli([name, "--bogus", "--help"]);
		expect(r.code).toBe(0);
		expect(r.stdout.startsWith(`用法: jotl ${name} `)).toBe(true);
		expect(r.stdout).not.toContain("{");
		expect(cli(["help", name]).stdout).toBe(r.stdout);
	});

	it.each([["--version"], ["-v"]])("%s 输出 package.json 中的版本号", flag => {
		const r = cli([flag]);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(`${VERSION}\n`);
	});
});

describe("用法错误: 退出码 2, 不输出结果", () => {
	const cases: [string, string[], string, MemoryFiles?][] = [
		["没有命令", [], "JOTL9012"],
		["未知命令", ["build"], "JOTL9001"],
		["help 后的未知命令", ["help", "build"], "JOTL9001"],
		["命令前的未知选项", ["--verbose"], "JOTL9002"],
		["未知选项", ["compile", SOURCE, "--verbose"], "JOTL9002"],
		["缺少位置参数", ["compile"], "JOTL9006"],
		["validate 缺少数据文件", ["validate", SOURCE], "JOTL9006"],
		["多余的位置参数", ["compile", SOURCE, "extra.jotl"], "JOTL9007"],
		["选项缺少取值", ["compile", SOURCE, "--out"], "JOTL9003"],
		["选项的取值被下一个选项占用", ["compile", SOURCE, "--out", "--typia-tags"], "JOTL9003"],
		["布尔选项带取值", ["compile", SOURCE, "--typia-tags=yes", "--to", "ts"], "JOTL9004"],
		["取值不在可选范围", ["compile", SOURCE, "--to", "yaml"], "JOTL9005"],
		[
			"--accept-newer-keywords 取值无效",
			["migrate-schema", `${CLI_FIXTURES}/newer-keyword.json`, "--accept-newer-keywords=no"],
			"JOTL9005",
		],
		[
			"fengdie DSL schema用 --schema-version",
			["migrate-schema", `${CLI_FIXTURES}/home.schema`, "--schema-version", "draft-07"],
			"JOTL9013",
		],
		[
			"fengdie JSON schema 用 --on-conflict",
			["migrate-schema", `${CLI_FIXTURES}/home.fengdie.json`, "--on-conflict", "error"],
			"JOTL9013",
		],
		[
			"fengdie DSL schema用 --accept-newer-keywords",
			["migrate-schema", `${CLI_FIXTURES}/home.schema`, "--accept-newer-keywords=true"],
			"JOTL9013",
		],
		[
			"migrate-schema --to 取值无效",
			["migrate-schema", `${CLI_FIXTURES}/home.schema`, "--to", "ts"],
			"JOTL9005",
		],
		["--typia-tags 不配 --to ts", ["compile", SOURCE, "--typia-tags"], "JOTL9011"],
		[
			"--config 与 --no-config 同用",
			["check", SOURCE, "--config", "jotl.config.json", "--no-config"],
			"JOTL9017",
		],
		["format 不读配置", ["format", SOURCE, "--no-config"], "JOTL9002"],
		["convert 缺少 --to", ["convert", SOURCE], "JOTL9006"],
		["convert 无法判断格式", ["convert", "input.yaml", "--to", "schema"], "JOTL9010"],
		["check 无法判断格式", ["check", SOURCE, "notes.txt"], "JOTL9009"],
		["--out 与输入相同", ["compile", SOURCE, "--out", SOURCE], "JOTL9008"],
		[
			"--out 换一种写法指向输入",
			["defaults", SOURCE, "--out", `./${SHARED_FIXTURES}/../${SOURCE}`],
			"JOTL9008",
		],
	];

	it.each(cases)("%s", (_name, argv, code) => {
		const r = cli(argv);
		expect(r.code).toBe(2);
		expect(r.stdout).toBe("");
		const lines = diagnosticLines(r.stderr);
		expect(lines).toEqual([
			expect.objectContaining({ location: "jotl", code, severity: "错误" }),
		]);
		expect(r.stderr).toMatch(/运行 `jotl( [a-z-]+)? --help` 查看用法\n$/);
		expect(r.io.files.size).toBe(0);
	});

	it("check 在任何文件被检查前就报告格式问题", () => {
		const r = cli(["check", `${SHARED_FIXTURES}/016-errors/source.jotl`, "notes.txt"]);
		expect(r.code).toBe(2);
		expect(diagnosticLines(r.stderr).map(d => d.code)).toEqual(["JOTL9009"]);
	});
});

type MemoryFiles = Record<string, string>;

describe("--out 输出到文件", () => {
	it.each([
		["compile", [SOURCE]],
		["convert", [SOURCE, "--to", "jotl"]],
		["defaults", [SOURCE]],
		["migrate-schema", [`${CLI_FIXTURES}/legacy-draft-04.json`, "--to", "schema"]],
		["migrate-schema", [`${CLI_FIXTURES}/home.schema`]],
	])("%s 写入 --out 指定的文件, stdout 为空, 内容与不带 --out 时相同", (command, args) => {
		const toStdout = cli([command, ...args]);
		const toFile = cli([command, ...args, "--out", "mem/out.txt"]);
		expect(toFile.code).toBe(toStdout.code);
		expect(toFile.stdout).toBe("");
		expect(written(toFile, "mem/out.txt")).toBe(toStdout.stdout);
		expect(toStdout.stdout.length).toBeGreaterThan(0);
	});

	it("写文件失败: JOTL9051, 退出码 1", () => {
		const r = cli(["compile", SOURCE, "--out", "mem/locked.json"], {
			failWrites: { "mem/locked.json": "EACCES" },
		});
		expect(r.code).toBe(1);
		expect(r.stdout).toBe("");
		expect(diagnosticLines(r.stderr)).toEqual([
			expect.objectContaining({
				location: "mem/locked.json",
				code: "JOTL9051",
				message: expect.stringContaining("没有权限"),
			}),
		]);
	});

	it("有错误级诊断时不写文件", () => {
		const r = cli([
			"compile",
			`${SHARED_FIXTURES}/016-errors/source.jotl`,
			"--out",
			"mem/out.json",
		]);
		expect(r.code).toBe(1);
		expect(written(r, "mem/out.json")).toBeUndefined();
	});
});
