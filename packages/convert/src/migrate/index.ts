// 迁移到 Jotl: 旧版本 JSON Schema 与 OpenAPI / Swagger Schema Object 升级到 2020-12, 凤蝶 schema(源码或 umo JSON)迁移为 Jotl.
export * from "./upgrade/index.js";
export {
	DEFAULT_FENGDIE_FILE,
	MIGRATE_DIAGNOSTICS,
	fengdieToUmoJson,
	isKnownUmoType,
	migrateFengdie,
	umoJsonToSchema,
	type FengdieUmoResult,
	type MigrateDiagnosticCode,
	type MigrateFengdieResult,
	type UmoEnumItem,
	type UmoJson,
	type UmoMetaValue,
	type UmoNode,
	type UmoOrigin,
	type UmoOrigins,
	type UmoToSchemaOptions,
} from "./fengdie/index.js";
export {
	detectMigrateInput,
	umoJsonFeature,
	type MigrateInputDetection,
	type MigrateInputKind,
} from "./detect-input.js";
