// 单文档升级入口: 识别版本, 逐级改写, 改写 $ref, 写入 2020-12 的 $schema 并按规范化顺序输出.
import {
  type Diagnostic,
  type JsonSchema,
  JSON_SCHEMA_DIALECT,
  type Result,
  fail,
  hasErrors,
  isSchemaObject,
  ok,
  orderKeywords,
} from '@jotl/core';
import { type VersionSource, detectVersion } from './detect.js';
import { upgradeDiagnostic } from './diagnostics.js';
import { type ResourceLookup, rewriteRefs, walkRefTargets } from './refs.js';
import { type ConflictPolicy, type DocumentState, locate, transformDocument } from './transform.js';
import type { SchemaVersion } from './versions.js';

export interface UpgradeOptions {
  /** 没有可识别的 `$schema` 时采用的版本; 不给且无法推断时报错. */
  version?: SchemaVersion;
  /** 声明版本中不存在的高版本关键字是否按 2020-12 语义接受. */
  acceptNewerKeywords?: boolean;
  /** 新旧语义冲突时的处理: 报错终止, 按声明版本处理, 或按 2020-12 处理. */
  onConflict?: ConflictPolicy;
  /** 文档 URI: 解析相对 `$id` / `$ref` 的基准, 并写入诊断位置的 document. */
  uri?: string;
}

/** D14 的默认值. */
export const DEFAULT_UPGRADE_OPTIONS = {
  acceptNewerKeywords: true,
  onConflict: 'error',
} as const satisfies Required<Pick<UpgradeOptions, 'acceptNewerKeywords' | 'onConflict'>>;

export interface UpgradedSchema {
  schema: JsonSchema;
  /** 识别出的源版本. */
  version: SchemaVersion;
  versionSource: VersionSource;
}

/** 识别版本并完成节点改写; 识别失败时返回 undefined 与诊断. */
export function prepareDocument(
  schema: unknown,
  options: UpgradeOptions
): { state: DocumentState | undefined; source: VersionSource | undefined; diagnostics: Diagnostic[] } {
  const detectOptions = {
    ...(options.version !== undefined ? { version: options.version } : {}),
    ...(options.uri !== undefined ? { uri: options.uri } : {}),
  };
  const detected = detectVersion(schema, detectOptions);
  if (detected.value === undefined) return { state: undefined, source: undefined, diagnostics: detected.diagnostics };
  const state = transformDocument(schema, detected.value.version, {
    acceptNewerKeywords: options.acceptNewerKeywords ?? DEFAULT_UPGRADE_OPTIONS.acceptNewerKeywords,
    onConflict: options.onConflict ?? DEFAULT_UPGRADE_OPTIONS.onConflict,
    uri: options.uri,
  });
  state.diagnostics.unshift(...detected.diagnostics);
  return { state, source: detected.value.source, diagnostics: state.diagnostics };
}

/** 根上写入 2020-12 的 `$schema` 并按规范化顺序排列关键字. */
export function finalizeDocument(state: DocumentState): JsonSchema {
  const root = state.root;
  if (!isSchemaObject(root)) return root as JsonSchema;
  if (root.$schema !== JSON_SCHEMA_DIALECT) {
    const added = root.$schema === undefined;
    state.diagnostics.push(
      upgradeDiagnostic(
        added ? 'JOTL3131' : 'JOTL3119',
        { dialect: JSON_SCHEMA_DIALECT },
        { location: locate(added ? '' : '/$schema', state.uri) }
      )
    );
    root.$schema = JSON_SCHEMA_DIALECT;
  }
  return orderKeywords(root as JsonSchema);
}

/** 升级单个 schema 到 2020-12; 不修改输入. 跨文档引用的目标按引用方的版本推算, 需要精确换算时用 upgradeDocuments. */
export function upgradeSchema(schema: unknown, options: UpgradeOptions = {}): Result<UpgradedSchema> {
  const { state, source, diagnostics } = prepareDocument(schema, options);
  if (state === undefined || source === undefined) return fail(diagnostics);
  const lookup: ResourceLookup = uri => {
    const resource = state.resources.get(uri);
    return resource === undefined ? undefined : { state, resource };
  };
  walkRefTargets([state], lookup);
  rewriteRefs(state, lookup);
  const output = finalizeDocument(state);
  if (hasErrors(state.diagnostics)) return fail(state.diagnostics);
  return ok({ schema: output, version: state.version, versionSource: source }, state.diagnostics);
}
