// 中英双语: 三张诊断表的英文覆盖与占位符一致, 以及升级, 凤蝶迁移, TS 互转与输入判定的英文输出.
import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "@jotl/core";
import {
  GENERATED_HEADER_EN,
  MIGRATE_DIAGNOSTICS,
  TS_DIAGNOSTICS,
  detectMigrateInput,
  migrateFengdie,
  schemaToTs,
  umoJsonToSchema,
  upgradeSchema,
} from "../src/index.js";
import { tsToSchema } from "../src/from-ts.js";
import { UPGRADE_DIAGNOSTICS } from "../src/migrate/upgrade/diagnostics.js";

const placeholders = (text: string): string[] => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

afterEach(() => setLocale("zh-CN"));

describe("诊断表英文覆盖", () => {
  for (const [name, table] of [
    ["TS_DIAGNOSTICS", TS_DIAGNOSTICS],
    ["MIGRATE_DIAGNOSTICS", MIGRATE_DIAGNOSTICS],
    ["UPGRADE_DIAGNOSTICS", UPGRADE_DIAGNOSTICS],
  ] as const) {
    it(`${name} 每项都有 en, 且占位符集合与中文一致`, () => {
      for (const [code, def] of Object.entries(table) as [string, { message: string; en?: string }][]) {
        expect(def.en, code).toBeTypeOf("string");
        expect(placeholders(def.en!), code).toEqual(placeholders(def.message));
      }
    });
  }
});

describe("英文输出", () => {
  it("升级的变更清单与冲突处理说明", () => {
    setLocale("en");
    const result = upgradeSchema({ $schema: "http://json-schema.org/draft-04/schema#", id: "https://x.test/a.json", definitions: { a: { type: "string" } } });
    expect(result.diagnostics.map((d) => d.message)).toEqual(
      expect.arrayContaining(["id rewritten to $id", "definitions rewritten to $defs", "$schema rewritten to https://json-schema.org/draft/2020-12/schema"]),
    );
    const conflict = upgradeSchema(
      { $schema: "http://json-schema.org/draft-07/schema#", definitions: { a: {} }, $defs: { a: {} } },
      { onConflict: "preferDeclared" },
    );
    const related = conflict.diagnostics.find((d) => d.code === "JOTL3301")?.related?.map((r) => r.message);
    expect(related).toEqual(["Handled per the declared version draft-07"]);
  });

  it("凤蝶迁移: 语法错误的期望记号与 umo JSON 结构错误的原因", () => {
    setLocale("en");
    const syntax = migrateFengdie("Object(a) {\n  b: \n}");
    expect(syntax.diagnostics.find((d) => d.code === "JOTL8002")?.message).toMatch(/^Fengdie schema syntax error: expected .+ here, got /);
    expect(umoJsonToSchema(1).diagnostics.find((d) => d.code === "JOTL8007")?.message).toBe("Invalid umo JSON structure: root: should be an object");
  });

  it("schema → TS 的文件头与默认弃用说明, 读回不产生 x-deprecatedReason", () => {
    setLocale("en");
    const text = schemaToTs({ $schema: "https://json-schema.org/draft/2020-12/schema", type: "string", deprecated: true }).value!;
    expect(text.startsWith(`${GENERATED_HEADER_EN}\n`)).toBe(true);
    expect(text).toContain("@deprecated Deprecated.");
    expect(tsToSchema(text).value).not.toHaveProperty("x-deprecatedReason");
  });

  it("TS → schema 的标签取值说明", () => {
    setLocale("en");
    const result = tsToSchema("export interface A {\n  /** @minimum abc */\n  n: number;\n}\n");
    expect(result.diagnostics.find((d) => d.code === "JOTL2116")?.message).toBe("Invalid value for tag @minimum; expected a number");
  });

  it("迁移输入判定的依据", () => {
    setLocale("en");
    expect(detectMigrateInput("Object(a) {}").reason).toBe("not JSON text (does not start with `{` or `[`)");
    setLocale("zh-CN");
    expect(detectMigrateInput("Object(a) {}").reason).toBe("不是 JSON 文本(不以 `{` 或 `[` 开头)");
  });
});
