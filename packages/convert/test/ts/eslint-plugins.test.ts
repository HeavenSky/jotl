// lint 预设实测: 按 docs/lint-presets.md 的写法加载 eslint-plugin-jsdoc 与 eslint-plugin-tsdoc, 对 schemaToTs 的产物 lint.
import { dirname, join } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { ESLint, type Linter } from "eslint";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import { describe, expect, it } from "vitest";
import { definedTags } from "../../src/ts/eslint.js";
import { CUSTOM_TAGS, schemaToTs } from "../../src/ts/index.js";
import { CONSUMER_DIR, ensureConsumerLink } from "./support.js";

const branch = (kind: string, title: string) => ({ title, type: "object", properties: { kind: { type: "string", const: kind } }, required: ["kind"] });

/** 产物覆盖全部自定义标签; 默认导出与根不同, 根类型上写 `@root` `@id` `@rules` `@widgets`. */
const SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.com/form",
  $ref: "#/$defs/Form",
  "x-ui": { version: 1, rules: [{ match: { type: "boolean" }, ui: { widget: "checkbox" } }], widgets: { Rating: { base: "integer", module: "./r.js" } } },
  $defs: {
    Root: { type: "object", properties: { a: { type: "string" } } },
    Form: {
      type: "object",
      properties: {
        name: { title: "名称", type: "string", minLength: 1, maxLength: 20, pattern: "^[a-z]+$", format: "email", errorMessage: "必填", "x-ui": { widget: "textarea" } },
        secret: { type: "string", writeOnly: true, contentMediaType: "text/plain", contentEncoding: "base64", "x-ui": { widget: "textarea", hidden: true } },
        count: { type: "integer", minimum: 0, maximum: 10, multipleOf: 2 },
        ratio: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 1 },
        tags: { type: "array", items: { type: "string", "x-ui": { widget: "tag" } }, minItems: 1, maxItems: 3, uniqueItems: true },
        rows: { type: "array", items: { type: "string", "x-ui": { widget: "tag", hidden: true } } },
        level: { oneOf: [{ const: "a", title: "甲", description: "说明" }, { const: "b", title: "乙" }] },
        note: { description: "备注", type: "string", default: "x", examples: ["y"], $comment: "内部", deprecated: true, readOnly: true },
        map: { type: "object", minProperties: 1, maxProperties: 2, additionalProperties: { type: "string" } },
        date: { type: "string", "x-valueFormat": "YYYY-MM-DD" },
        price: {
          type: "object",
          properties: { type: { type: "string", const: "money" }, value: { type: "string" }, currency: { type: "string", const: "CNY" } },
          required: ["type", "value", "currency"],
          additionalProperties: false,
          "x-decimalRange": { minimum: "0" },
        },
        shape: { oneOf: [branch("a", "甲"), branch("b", "乙")] },
      },
    },
  },
};

const generated = schemaToTs(SCHEMA as never, { defaultExport: "Root" });
const TEXT = generated.value as string;

/** 在 `cwd` 下 lint 产物; 不读配置文件, 只用给出的 flat config. */
async function lint(cwd: string, config: Linter.Config): Promise<Linter.LintMessage[]> {
  const eslint = new ESLint({ cwd, overrideConfigFile: true, overrideConfig: [{ files: ["**/*.ts"], languageOptions: { parser: tsParser } }, config] });
  const [result] = await eslint.lintText(TEXT, { filePath: join(cwd, "form.ts") });
  return result!.messages;
}

/** 告警里报出的标签名. */
const flaggedTags = (messages: Linter.LintMessage[], pattern: RegExp): string[] => messages.flatMap((m) => pattern.exec(m.message)?.[1] ?? []);

describe("eslint 插件加载预设后接受全部自定义标签", () => {
  it("产物覆盖全部自定义标签", () => {
    expect(generated.diagnostics).toEqual([]);
    for (const { name } of CUSTOM_TAGS) expect(TEXT, name).toMatch(new RegExp(`^\\s*\\* @${name}\\b`, "m"));
  });

  it("eslint-plugin-jsdoc: check-tag-names 传入 definedTags 后零告警; 不传时报出自定义标签(对照)", async () => {
    expect(await lint(CONSUMER_DIR, { plugins: { jsdoc }, rules: { "jsdoc/check-tag-names": ["error", { definedTags: [...definedTags] }] } })).toEqual([]);
    const bare = await lint(CONSUMER_DIR, { plugins: { jsdoc }, rules: { "jsdoc/check-tag-names": "error" } });
    expect(bare.every((m) => m.ruleId === "jsdoc/check-tag-names")).toBe(true);
    expect(flaggedTags(bare, /^Invalid JSDoc tag name "(\w+)"/)).toEqual(expect.arrayContaining([...CUSTOM_TAGS.map((t) => t.name), "defaultValue"]));
  });

  it("eslint-plugin-tsdoc: ESLint 工作目录的 tsdoc.json extends 预设后零告警; 工作目录没有 tsdoc.json 时报出自定义标签(对照)", async () => {
    ensureConsumerLink();
    const config: Linter.Config = { plugins: { tsdoc }, rules: { "tsdoc/syntax": "warn" } };
    expect(await lint(CONSUMER_DIR, config)).toEqual([]);
    const bare = await lint(dirname(CONSUMER_DIR), config);
    expect(bare.every((m) => m.ruleId === "tsdoc/syntax" && m.messageId === "tsdoc-undefined-tag")).toBe(true);
    expect(flaggedTags(bare, /The TSDoc tag "@(\w+)" is not defined/).sort()).toEqual(CUSTOM_TAGS.map((t) => t.name).sort());
  });
});
