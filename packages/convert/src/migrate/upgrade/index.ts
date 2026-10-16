// 旧版本 JSON Schema 与 OpenAPI / Swagger Schema Object 升级到 2020-12, 含宽松模式, 冲突策略与跨文件升级.
export { detectVersion, type DetectOptions, type VersionDetection, type VersionSource } from "./detect.js";
export { UPGRADE_DIAGNOSTICS, upgradeDiagnostic, type UpgradeDiagnosticCode } from "./diagnostics.js";
export {
  upgradeDocuments,
  type DocumentLoader,
  type UpgradeDocumentsOptions,
  type UpgradedDocument,
  type UpgradedDocuments,
} from "./documents.js";
export { RECURSIVE_ANCHOR_NAME } from "./levels/2019-09-to-2020-12.js";
export type { ConflictPolicy } from "./transform.js";
export { DEFAULT_UPGRADE_OPTIONS, upgradeSchema, type UpgradeOptions, type UpgradedSchema } from "./upgrade.js";
export { SCHEMA_VERSIONS, isSchemaVersion, type SchemaVersion } from "./versions.js";
