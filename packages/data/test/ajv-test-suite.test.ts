// 用官方 JSON-Schema-Test-Suite(draft2020-12)测量 ajv/dist/2020 的符合度, 不一致项以排除清单显式登记.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createAjv } from "../src/ajv-instance.js";

const SUITE_DIR = fileURLToPath(new URL("../../../vendor/json-schema-test-suite/", import.meta.url));
const TESTS_DIR = join(SUITE_DIR, "tests/draft2020-12");
const REMOTES_DIR = join(SUITE_DIR, "remotes");
const REMOTE_BASE = "http://localhost:1234/";
const EXCLUSIONS_PATH = fileURLToPath(new URL("./ajv-test-suite-exclusions.json", import.meta.url));

interface SuiteTest {
  description: string;
  data: unknown;
  valid: boolean;
}

interface SuiteGroup {
  description: string;
  schema: unknown;
  tests: SuiteTest[];
}

/** 分区 → 文件 → 用例组 → 不一致的用例描述. */
type Mismatches = Record<string, Record<string, Record<string, string[]>>>;

type Section = "core" | "optional" | "format";

function listJson(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? listJson(path) : name.endsWith(".json") ? [path] : [];
    })
    .sort();
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sectionOf(file: string): Section {
  if (file.startsWith("optional/format/")) return "format";
  return file.startsWith("optional/") ? "optional" : "core";
}

/** 与 validate 同配置(含 format 断言), 只关 strictSchema 以容纳未知关键字; 每组用新实例, 编译失败时整组计入不一致. */
function runGroup(group: SuiteGroup, remotes: [string, unknown][]): string[] {
  let check: ((data: unknown) => boolean) | undefined;
  try {
    const ajv = createAjv({ strictSchema: false, logger: false });
    for (const [uri, schema] of remotes) {
      try {
        ajv.addSchema(schema as object, uri);
      } catch {
        // 其他草案的远程 schema(draft7 等)在 2020 模式下加载失败, 用到它们的用例会计入不一致.
      }
    }
    const compiled = ajv.compile(group.schema as object);
    check = (data) => compiled(data);
  } catch {
    check = undefined;
  }
  return group.tests
    .filter((t) => {
      try {
        return check?.(t.data) !== t.valid;
      } catch {
        return true;
      }
    })
    .map((t) => t.description);
}

const suiteAvailable = existsSync(TESTS_DIR);

describe("官方测试集 draft2020-12 跑 ajv/dist/2020", () => {
  it("测试集已下载", () => {
    expect(suiteAvailable, "缺少 vendor/json-schema-test-suite/, 先运行 bash scripts/fetch-json-schema-test-suite.sh").toBe(true);
  });
  if (!suiteAvailable) return;

  const remotes: [string, unknown][] = listJson(REMOTES_DIR).map((path) => [
    REMOTE_BASE + relative(REMOTES_DIR, path).split("\\").join("/"),
    readJson(path),
  ]);
  const totals: Record<Section, number> = { core: 0, optional: 0, format: 0 };
  const actual: Mismatches = { core: {}, optional: {}, format: {} };
  for (const path of listJson(TESTS_DIR)) {
    const file = relative(TESTS_DIR, path).split("\\").join("/");
    const section = sectionOf(file);
    for (const group of readJson(path) as SuiteGroup[]) {
      totals[section] += group.tests.length;
      const failed = runGroup(group, remotes);
      if (failed.length === 0) continue;
      // biome-ignore lint/suspicious/noAssignInExpressions: ??= 取已有分组或新建, 惯用写法
      const byFile = (actual[section]![file] ??= {});
      byFile[group.description] = failed;
    }
  }
  const expected = readJson(EXCLUSIONS_PATH) as Mismatches;

  for (const section of ["core", "optional", "format"] as const) {
    it(`${section}: 不一致的用例与排除清单完全相同`, () => {
      expect(totals[section]).toBeGreaterThan(0);
      expect(actual[section]).toEqual(expected[section]);
    });
  }
});
