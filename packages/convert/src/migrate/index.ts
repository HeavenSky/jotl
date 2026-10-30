// 迁移到 Jotl: 旧版本 JSON Schema 与 OpenAPI / Swagger Schema Object 升级到 2020-12, fengdie DSL schema(源码或 fengdie JSON schema)迁移为 Jotl.
export * from "./upgrade/index.js";
export {
	DEFAULT_FENGDIE_FILE,
	MIGRATE_DIAGNOSTICS,
	parseFengdieJson,
	isKnownFengdieJsonType,
	migrateFengdie,
	fengdieJsonToSchema,
	type FengdieJsonResult,
	type MigrateDiagnosticCode,
	type MigrateFengdieResult,
	type FengdieJsonEnumItem,
	type FengdieJson,
	type FengdieJsonMetaValue,
	type FengdieJsonNode,
	type FengdieJsonOrigin,
	type FengdieJsonOrigins,
	type FengdieJsonToSchemaOptions,
} from "./fengdie/index.js";
export {
	detectMigrateInput,
	fengdieJsonFeature,
	type MigrateInputDetection,
	type MigrateInputKind,
} from "./detect-input.js";
