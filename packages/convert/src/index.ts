// Jotl 与其他格式互转: JSON Schema → TS + JSDoc(ts/), 旧版 JSON Schema 与 OpenAPI 升级, fengdie DSL schema 迁移(migrate/).
// TS → JSON Schema 依赖 typescript 编译器, 单独从 @jotl/convert/from-ts 导出, 只用本入口时不会打包编译器.
export {
	GENERATED_HEADER,
	GENERATED_HEADER_EN,
	schemaToTs,
	type SchemaToTsOptions,
} from "./ts/schema-to-ts.js";
export { TS_DIAGNOSTICS, tsDiagnostic, type TsDiagnosticCode } from "./ts/diagnostics.js";
export { CUSTOM_TAGS, type CustomTagDefinition, type TagSyntax } from "./ts/tags.js";
export * from "./migrate/index.js";
