// lint 预设: tsdoc.json 的标签定义与 extends 链路, eslint 的 definedTags, 以及包导出.
import { lstatSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { definedTags } from "../../src/ts/eslint.js";
import { CUSTOM_TAGS } from "../../src/ts/index.js";
import { PACKAGE_DIR, PRESET_PATH, loadTsdocParser, tsdocMessages } from "./support.js";

interface TsdocJson {
  extends?: string[];
  tagDefinitions?: { tagName: string; syntaxKind: string }[];
}

const preset = JSON.parse(readFileSync(PRESET_PATH, "utf8")) as TsdocJson;
const CONSUMER_DIR = join(PACKAGE_DIR, "test", "ts", "tsdoc-consumer");

/** 消费方目录下的 node_modules/@jotl/convert 链接到本包, 模拟安装后的解析路径; node_modules 不入库, 缺失时创建. */
function ensureConsumerLink(): void {
  const link = join(CONSUMER_DIR, "node_modules", "@jotl", "convert");
  try {
    lstatSync(link);
    return;
  } catch {
    // 不存在时创建.
  }
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(relative(dirname(link), PACKAGE_DIR), link, "dir");
}

const SAMPLE = `/**
 * 描述
 * @title 标题
 * @minLength 1
 * @pattern \`^[a-z]+$\`
 * @asType integer
 * @enumTitles \`{"a":"甲"}\`
 * @ui \`{"widget":"textarea","hidden":true}\`
 * @widget color-picker
 * @errorMessage "必填"
 * @uniqueItems
 * @writeOnly
 * @readonly
 * @defaultValue "a"
 * @privateRemarks 备注
 * @example 1
 * @deprecated 改用 b
 */`;

describe("tsdoc.json", () => {
  it("定义 README 标签协议中的全部自定义标签, 修饰标签为 modifier", () => {
    expect(preset.tagDefinitions).toEqual(CUSTOM_TAGS.map((t) => ({ tagName: `@${t.name}`, syntaxKind: t.syntax })));
    const names = CUSTOM_TAGS.map((t) => t.name);
    for (const name of ["title", "asType", "ui", "widget", "enumTitles", "errorMessage", "writeOnly", "uniqueItems"]) {
      expect(names).toContain(name);
    }
  });

  it("预设本身加载无错误, 全部标签零告警", () => {
    const { parser, errors } = loadTsdocParser(PRESET_PATH);
    expect(errors).toBeUndefined();
    expect(tsdocMessages(parser, SAMPLE)).toEqual([]);
  });

  it("未加载预设时同一注释会告警(对照)", () => {
    const { parser } = loadTsdocParser(join(CONSUMER_DIR, "no-preset.tsdoc.json"));
    expect(tsdocMessages(parser, SAMPLE).length).toBeGreaterThan(0);
  });

  it("消费方以 extends: [\"@jotl/convert/tsdoc.json\"] 按包名解析并继承标签定义", () => {
    ensureConsumerLink();
    const { parser, errors } = loadTsdocParser(join(CONSUMER_DIR, "tsdoc.json"));
    expect(errors).toBeUndefined();
    expect(tsdocMessages(parser, SAMPLE)).toEqual([]);
  });
});

describe("eslint 预设", () => {
  it("definedTags 为自定义标签加 defaultValue 与 privateRemarks", () => {
    expect(definedTags).toEqual([...CUSTOM_TAGS.map((t) => t.name), "defaultValue", "privateRemarks"]);
  });
});

describe("包导出", () => {
  it("exports 含 tsdoc.json 与 eslint 子路径, files 含 tsdoc.json", () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      files: string[];
    };
    expect(pkg.exports["./tsdoc.json"]).toBe("./tsdoc.json");
    expect(pkg.exports["./eslint"]).toEqual({ types: "./dist/eslint.d.ts", import: "./dist/eslint.js" });
    expect(pkg.files).toContain("tsdoc.json");
  });

  it("JSON Schema → TS 的模块不依赖 typescript 包", () => {
    const sources = ["schema-to-ts.ts", "typia.ts", "value-codec.ts", "tags.ts", "diagnostics.ts"];
    for (const file of sources) {
      const text = readFileSync(join(PACKAGE_DIR, "src", "ts", file), "utf8");
      const imports = [...text.matchAll(/^import\b[^;]*?from "([^"]+)";/gm)].map((m) => m[1]);
      if (file === "schema-to-ts.ts") expect(imports).toContain("@jotl/core");
      expect(imports.every((m) => m === "@jotl/core" || m?.startsWith("./"))).toBe(true);
      expect(imports.filter((m) => m?.startsWith("./")).every((m) => sources.includes((m as string).slice(2).replace(/\.js$/, ".ts")))).toBe(true);
    }
  });
});
