// 正确性验证(V7): 官方 JSON-Schema-Test-Suite 中 draft4/6/7/2019-09 的必选用例, 升级后在 ajv/dist/2020 下结果与期望一致.
// 范围是 tests/<版本>/ 顶层文件; optional/ 是规范可选行为(format 断言, 大数等), 不在验收范围内.
// 运行器以 acceptNewerKeywords: false, onConflict: "preferDeclared" 升级, 即严格保持声明版本的语义.
import { describe, expect, it } from "vitest";
import { type CaseOutcome, SUITE_DRAFTS, type SuiteDraft, listSuiteFiles, runSuiteFile, suiteAvailable } from "./suite-runner.js";

const AJV_PROTOTYPE_NAMES =
  "Ajv 2020 自身的限制: 属性名为 __proto__ / toString / constructor 时结果错误, draft2020-12 的同名用例直接用 Ajv 校验同样不一致";
const AJV_EMPTY_ENUM = "Ajv 2020 自身的限制: 拒绝编译空 enum(\"enum must have non-empty array\"), draft2020-12 同名用例同样失败";
const AJV_UNEVALUATED = "Ajv 2020 自身的限制: 没有 then/else 的 if 产生的注解未计入 unevaluated*, draft2020-12 同名用例同样失败";
const AJV_NESTED_ITEMS = "Ajv 2020 自身的限制: 嵌套 items 的注解未计入 unevaluatedItems, draft2020-12 同名用例同样失败";
const DRAFT04_METASCHEMA = "依赖 draft-04 元 schema(远程引用), Ajv 8 不再附带, 本地没有离线副本";
const CUSTOM_VOCABULARY = "依赖远程自定义元 schema 通过 $vocabulary 关闭校验词汇表, Ajv 不支持按元 schema 选择词汇表";

const PROTOTYPE_TESTS = ["none of the properties mentioned", "__proto__ present", "toString present", "constructor present"];
const PROTOTYPE_GROUP = "required properties whose names are Javascript object property names";
const PROPERTIES_GROUP = "properties whose names are Javascript object property names";

interface Exclusion {
  file: string;
  group: string;
  tests: string[];
  reason: string;
}

function prototypeExclusions(): Exclusion[] {
  return [
    { file: "properties.json", group: PROPERTIES_GROUP, tests: ["none of the properties mentioned"], reason: AJV_PROTOTYPE_NAMES },
    { file: "required.json", group: PROTOTYPE_GROUP, tests: PROTOTYPE_TESTS, reason: AJV_PROTOTYPE_NAMES },
  ];
}

/** 显式排除清单: 每条都必须仍然不一致, 否则测试失败, 提示从清单移除. */
const EXCLUSIONS: Record<SuiteDraft, Exclusion[]> = {
  draft4: [
    {
      file: "definitions.json",
      group: "validate definition against metaschema",
      tests: ["valid definition schema", "invalid definition schema"],
      reason: DRAFT04_METASCHEMA,
    },
    {
      file: "ref.json",
      group: "remote ref, containing refs itself",
      tests: ["remote ref valid", "remote ref invalid"],
      reason: DRAFT04_METASCHEMA,
    },
    ...prototypeExclusions(),
  ],
  draft6: prototypeExclusions(),
  draft7: prototypeExclusions(),
  "draft2019-09": [
    {
      file: "enum.json",
      group: "empty enum",
      tests: ["string is invalid", "number is invalid", "null is invalid", "object is invalid", "array is invalid", "boolean is invalid"],
      reason: AJV_EMPTY_ENUM,
    },
    {
      file: "unevaluatedItems.json",
      group: "unevaluatedItems with nested items",
      tests: ["with no additional items", "with invalid additional item"],
      reason: AJV_NESTED_ITEMS,
    },
    {
      file: "unevaluatedItems.json",
      group: "unevaluatedItems can see annotations from if without then and else",
      tests: ["valid in case if is evaluated"],
      reason: AJV_UNEVALUATED,
    },
    {
      file: "unevaluatedProperties.json",
      group: "unevaluatedProperties with if/then/else, then not defined",
      tests: ["when if is true and has no unevaluated properties", "when if is false and has unevaluated properties"],
      reason: AJV_UNEVALUATED,
    },
    {
      file: "unevaluatedProperties.json",
      group: "unevaluatedProperties can see annotations from if without then and else",
      tests: ["valid in case if is evaluated"],
      reason: AJV_UNEVALUATED,
    },
    {
      file: "vocabulary.json",
      group: "schema that uses custom metaschema with with no validation vocabulary",
      tests: ["no validation: invalid number, but it still validates"],
      reason: CUSTOM_VOCABULARY,
    },
    ...prototypeExclusions(),
  ],
};

function key(o: { group: string; test: string }): string {
  return `${o.group} | ${o.test}`;
}

function excludedKeys(draft: SuiteDraft, file: string): string[] {
  return EXCLUSIONS[draft]
    .filter((e) => e.file === file)
    .flatMap((e) => e.tests.map((test) => key({ group: e.group, test })))
    .sort();
}

it("官方测试集已下载(缺失时先运行 bash scripts/fetch-json-schema-test-suite.sh)", () => {
  expect(suiteAvailable()).toBe(true);
});

describe.runIf(suiteAvailable()).each(Object.keys(SUITE_DRAFTS) as SuiteDraft[])("官方测试集 %s 升级后在 Ajv 2020 下结果一致", (draft) => {
  const files = listSuiteFiles(draft);
  const outcomes: CaseOutcome[] = [];

  it.each(files)("%s", async (file) => {
    const results = await runSuiteFile(draft, file);
    outcomes.push(...results);
    const mismatched = results.filter((o) => !o.passed).map(key).sort();
    expect(mismatched).toEqual(excludedKeys(draft, file));
  });

  it("排除清单中的每个文件都存在, 每条都写明原因", () => {
    for (const e of EXCLUSIONS[draft]) {
      expect(files).toContain(e.file);
      expect(e.reason.length).toBeGreaterThan(0);
    }
    const excluded = EXCLUSIONS[draft].reduce((n, e) => n + e.tests.length, 0);
    expect(outcomes.filter((o) => !o.passed)).toHaveLength(excluded);
    expect(outcomes.filter((o) => o.passed).length).toBeGreaterThan(0);
  });
});
