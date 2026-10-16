import { describe, expect, it } from "vitest";
import { type SchemaVersion, detectVersion } from "../../../src/migrate/upgrade/index.js";
import { codes, find, pointerOf } from "./helpers.js";

interface Sample {
  name: string;
  schema: unknown;
  version?: SchemaVersion;
  expected: SchemaVersion;
  source: "declared" | "specified" | "inferred";
}

const SAMPLES: Sample[] = [
  { name: "draft-04: $schema", schema: { $schema: "http://json-schema.org/draft-04/schema#" }, expected: "draft-04", source: "declared" },
  { name: "draft-04: hyper-schema", schema: { $schema: "http://json-schema.org/draft-04/hyper-schema#" }, expected: "draft-04", source: "declared" },
  { name: "draft-04: id", schema: { id: "http://x.test/a.json", type: "string" }, expected: "draft-04", source: "inferred" },
  { name: "draft-04: 布尔 exclusiveMaximum", schema: { maximum: 3, exclusiveMaximum: true }, expected: "draft-04", source: "inferred" },
  { name: "draft-06: $schema", schema: { $schema: "http://json-schema.org/draft-06/schema#" }, expected: "draft-06", source: "declared" },
  { name: "draft-06: const", schema: { const: 1 }, expected: "draft-06", source: "inferred" },
  { name: "draft-06: 数值 exclusiveMinimum", schema: { exclusiveMinimum: 0 }, expected: "draft-06", source: "inferred" },
  { name: "draft-06: propertyNames 与 $id", schema: { $id: "a.json", propertyNames: { maxLength: 3 } }, expected: "draft-06", source: "inferred" },
  { name: "draft-07: $schema(https, 无 #)", schema: { $schema: "https://json-schema.org/draft-07/schema" }, expected: "draft-07", source: "declared" },
  { name: "draft-07: if/then", schema: { if: { type: "string" }, then: { minLength: 1 } }, expected: "draft-07", source: "inferred" },
  { name: "draft-07: $comment", schema: { $comment: "x", type: "string" }, expected: "draft-07", source: "inferred" },
  { name: "2019-09: $schema", schema: { $schema: "https://json-schema.org/draft/2019-09/schema" }, expected: "2019-09", source: "declared" },
  { name: "2019-09: $recursiveRef", schema: { $recursiveAnchor: true, properties: { a: { $recursiveRef: "#" } } }, expected: "2019-09", source: "inferred" },
  { name: "2019-09: dependentRequired", schema: { dependentRequired: { a: ["b"] } }, expected: "2019-09", source: "inferred" },
  { name: "2020-12: $schema", schema: { $schema: "https://json-schema.org/draft/2020-12/schema" }, expected: "2020-12", source: "declared" },
  { name: "2020-12: prefixItems", schema: { prefixItems: [{ type: "string" }] }, expected: "2020-12", source: "inferred" },
  { name: "2020-12: $dynamicRef", schema: { $dynamicAnchor: "node", items: { $dynamicRef: "#node" } }, expected: "2020-12", source: "inferred" },
  { name: "OpenAPI 3.0: nullable", schema: { type: "string", nullable: true }, expected: "openapi-3.0", source: "inferred" },
  { name: "OpenAPI 3.0: discriminator 对象", schema: { oneOf: [], discriminator: { propertyName: "kind" } }, expected: "openapi-3.0", source: "inferred" },
  { name: "OpenAPI 3.0: 调用方指定", schema: { type: "string", example: "x" }, version: "openapi-3.0", expected: "openapi-3.0", source: "specified" },
  { name: "Swagger 2.0: x-nullable", schema: { type: "string", "x-nullable": true }, expected: "swagger-2.0", source: "inferred" },
  { name: "Swagger 2.0: type file", schema: { type: "file" }, expected: "swagger-2.0", source: "inferred" },
  { name: "Swagger 2.0: discriminator 字符串", schema: { discriminator: "kind", properties: { kind: { type: "string" } } }, expected: "swagger-2.0", source: "inferred" },
  { name: "OpenAPI 3.1: dialect", schema: { $schema: "https://spec.openapis.org/oas/3.1/dialect/base" }, expected: "openapi-3.1", source: "declared" },
  { name: "OpenAPI 3.1: 带日期的 dialect", schema: { $schema: "https://spec.openapis.org/oas/3.1/dialect/2024-11-10" }, expected: "openapi-3.1", source: "declared" },
  { name: "OpenAPI 3.1: 调用方指定", schema: { type: "string" }, version: "openapi-3.1", expected: "openapi-3.1", source: "specified" },
];

describe("版本识别", () => {
  it.each(SAMPLES)("$name", ({ schema, version, expected, source }) => {
    const result = detectVersion(schema, version === undefined ? {} : { version });
    expect(result.value).toEqual({ version: expected, source });
  });

  it("每个版本至少 3 个样例", () => {
    const counts = new Map<SchemaVersion, number>();
    for (const s of SAMPLES) counts.set(s.expected, (counts.get(s.expected) ?? 0) + 1);
    for (const v of ["draft-04", "draft-06", "draft-07", "2019-09", "2020-12", "openapi-3.0", "swagger-2.0", "openapi-3.1"] as const) {
      expect(counts.get(v) ?? 0, v).toBeGreaterThanOrEqual(3);
    }
  });

  it("推断时记一条带位置的 info", () => {
    const result = detectVersion({ properties: { a: { maximum: 1, exclusiveMaximum: true } } });
    const note = find(result.diagnostics, "JOTL3007");
    expect(note?.severity).toBe("info");
    expect(pointerOf(note)).toBe("/properties/a/exclusiveMaximum");
  });

  it("$schema 优先于特征与调用方指定的版本", () => {
    const result = detectVersion({ $schema: "http://json-schema.org/draft-07/schema#", id: "a.json" }, { version: "draft-04" });
    expect(result.value).toEqual({ version: "draft-07", source: "declared" });
    expect(codes(result.diagnostics)).toEqual(["JOTL3006"]);
  });

  it("无法判定时要求调用方指定", () => {
    const result = detectVersion({ type: "string", minLength: 1 });
    expect(result.value).toBeUndefined();
    expect(codes(result.diagnostics)).toEqual(["JOTL3001"]);
    expect(detectVersion({ type: "string" }, { version: "draft-07" }).value).toEqual({ version: "draft-07", source: "specified" });
  });

  it("无法识别的 $schema 回退到调用方指定或特征推断, 并给出警告", () => {
    const specified = detectVersion({ $schema: "https://example.test/my-meta", type: "string" }, { version: "draft-06" });
    expect(specified.value).toEqual({ version: "draft-06", source: "specified" });
    expect(codes(specified.diagnostics)).toEqual(["JOTL3004"]);
    const inferred = detectVersion({ $schema: "https://example.test/my-meta", definitions: {} });
    expect(inferred.value).toEqual({ version: "draft-04", source: "inferred" });
    expect(codes(inferred.diagnostics)).toEqual(["JOTL3005", "JOTL3007"]);
  });

  it("JSON Schema 稳定版 v1 的 $schema 按 2020-12 识别", () => {
    for (const uri of ["https://json-schema.org/v1", "https://json-schema.org/v1/2026"]) {
      const result = detectVersion({ $schema: uri, type: "string" });
      expect(result.value).toEqual({ version: "2020-12", source: "declared" });
      expect(result.diagnostics).toEqual([]);
    }
  });

  it("draft-03 报明确诊断: $schema 或特征", () => {
    const declared = detectVersion({ $schema: "http://json-schema.org/draft-03/schema#" });
    expect(declared.value).toBeUndefined();
    expect(codes(declared.diagnostics)).toEqual(["JOTL3002"]);
    const inferred = detectVersion({ properties: { a: { type: "string", required: true } } });
    expect(inferred.value).toBeUndefined();
    expect(pointerOf(find(inferred.diagnostics, "JOTL3002"))).toBe("/properties/a/required");
  });

  it("非 schema 输入与非法的 version 选项报错而不抛异常", () => {
    expect(codes(detectVersion(42).diagnostics)).toEqual(["JOTL3003"]);
    expect(codes(detectVersion([]).diagnostics)).toEqual(["JOTL3003"]);
    expect(codes(detectVersion({}, { version: "draft-05" as SchemaVersion }).diagnostics)).toEqual(["JOTL3009"]);
  });
});
