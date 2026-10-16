// migrate/upgrade 的诊断代码表(JOTL3xxx): 识别错误, 改写记录, 宽松模式与冲突.
import { defineDiagnostics, formatMessage, getLocale } from "@jotl/core";

export const UPGRADE_DIAGNOSTICS = {
  // 30xx: 输入与版本识别
  JOTL3001: {
    severity: "error",
    message: "无法判定 JSON Schema 版本: 没有可识别的 $schema, 也没有能区分版本的关键字; 请通过 version 选项指定",
    en: "Cannot determine the JSON Schema version: no recognizable $schema and no version-specific keywords; specify it with the version option",
  },
  JOTL3002: { severity: "error", message: "不支持升级 draft-03 的 JSON Schema(依据: {evidence})", en: "Upgrading draft-03 JSON Schema is not supported (evidence: {evidence})" },
  JOTL3003: { severity: "error", message: "输入不是 JSON Schema: 必须是对象或布尔值", en: "Input is not a JSON Schema: must be an object or a boolean" },
  JOTL3004: { severity: "warning", message: "无法识别的 $schema: {uri}; 改按调用方指定的版本 {version} 处理", en: "Unrecognized $schema: {uri}; using the caller-specified version {version}" },
  JOTL3005: { severity: "warning", message: "无法识别的 $schema: {uri}; 改按特征推断版本", en: "Unrecognized $schema: {uri}; inferring the version from keywords" },
  JOTL3006: { severity: "warning", message: "$schema 声明为 {declared}, 与 version 选项 {option} 不同; 以 $schema 为准", en: "$schema declares {declared}, which differs from the version option {option}; $schema wins" },
  JOTL3007: { severity: "info", message: "未声明 $schema, 按特征 {keyword} 推断为 {version}", en: "No $schema declared; inferred {version} from keyword {keyword}" },
  JOTL3008: { severity: "warning", message: "嵌套的 $schema 无法识别: {uri}; 按外层版本 {version} 处理", en: "Unrecognized nested $schema: {uri}; using the outer version {version}" },
  JOTL3009: { severity: "error", message: "不支持的版本: {version}", en: "Unsupported version: {version}" },

  // 31xx: 逐级改写, 每处一条
  JOTL3101: { severity: "info", message: "id 改写为 $id", en: "id rewritten to $id" },
  JOTL3102: { severity: "info", message: "{keyword}: true 与 {bound} 合并为数值形式的 {keyword}", en: "{keyword}: true merged with {bound} into numeric {keyword}" },
  JOTL3103: { severity: "info", message: "{keyword}: false 无作用, 已移除", en: "{keyword}: false has no effect; removed" },
  JOTL3104: { severity: "info", message: "{keyword}: true 没有对应的 {bound}, 无作用, 已移除", en: "{keyword}: true has no matching {bound} and no effect; removed" },
  JOTL3105: { severity: "info", message: "definitions 改写为 $defs", en: "definitions rewritten to $defs" },
  JOTL3106: { severity: "info", message: "definitions 中的 {name} 合并到 $defs", en: "{name} in definitions merged into $defs" },
  JOTL3107: { severity: "info", message: "dependencies 中的 {name} 拆分到 dependentRequired", en: "{name} in dependencies split into dependentRequired" },
  JOTL3108: { severity: "info", message: "dependencies 中的 {name} 拆分到 dependentSchemas", en: "{name} in dependencies split into dependentSchemas" },
  JOTL3109: { severity: "info", message: "只含片段的 $id \"{id}\" 改写为 $anchor \"{anchor}\"", en: "Fragment-only $id \"{id}\" rewritten to $anchor \"{anchor}\"" },
  JOTL3110: { severity: "info", message: "$id \"{id}\" 拆分为 $id \"{base}\" 与 $anchor \"{anchor}\"", en: "$id \"{id}\" split into $id \"{base}\" and $anchor \"{anchor}\"" },
  JOTL3111: { severity: "info", message: "去掉 $id \"{id}\" 末尾的空片段", en: "Removed the trailing empty fragment of $id \"{id}\"" },
  JOTL3112: { severity: "info", message: "数组形式的 items 改写为 prefixItems", en: "Array-form items rewritten to prefixItems" },
  JOTL3113: { severity: "info", message: "additionalItems 改写为 items", en: "additionalItems rewritten to items" },
  JOTL3114: { severity: "info", message: "items 不是数组时 additionalItems 无作用, 已移除", en: "additionalItems has no effect when items is not an array; removed" },
  JOTL3115: { severity: "info", message: "$recursiveAnchor: true 改写为 $dynamicAnchor \"{anchor}\"", en: "$recursiveAnchor: true rewritten to $dynamicAnchor \"{anchor}\"" },
  JOTL3116: { severity: "info", message: "$recursiveAnchor 不在资源根上或取值不为 true, 无作用, 已移除", en: "$recursiveAnchor is not at a resource root or is not true, and has no effect; removed" },
  JOTL3117: { severity: "info", message: "$recursiveRef \"{ref}\" 改写为 $dynamicRef \"{dynamicRef}\"", en: "$recursiveRef \"{ref}\" rewritten to $dynamicRef \"{dynamicRef}\"" },
  JOTL3118: { severity: "info", message: "$recursiveRef \"{ref}\" 的目标没有 $recursiveAnchor, 改写为 $ref", en: "The target of $recursiveRef \"{ref}\" has no $recursiveAnchor; rewritten to $ref" },
  JOTL3119: { severity: "info", message: "$schema 改写为 {dialect}", en: "$schema rewritten to {dialect}" },
  JOTL3120: { severity: "info", message: "$ref 随关键字改名调整: \"{from}\" → \"{to}\"", en: "$ref adjusted for the keyword rename: \"{from}\" → \"{to}\"" },
  JOTL3121: { severity: "info", message: "x-nullable 改写为 nullable", en: "x-nullable rewritten to nullable" },
  JOTL3122: { severity: "info", message: "type: \"file\" 改写为 type: \"string\" 与 format: \"binary\"", en: "type: \"file\" rewritten to type: \"string\" with format: \"binary\"" },
  JOTL3123: { severity: "info", message: "字符串形式的 discriminator 改写为 {propertyName} 对象", en: "String-form discriminator rewritten to a {propertyName} object" },
  JOTL3124: { severity: "info", message: "nullable: true 改写为类型数组, 加入 \"null\"", en: "nullable: true rewritten to a type array including \"null\"" },
  JOTL3125: { severity: "info", message: "nullable: true 时在 enum 中加入 null", en: "nullable: true; added null to enum" },
  JOTL3126: { severity: "info", message: "没有 type 时 nullable 无作用, 已移除", en: "nullable has no effect without type; removed" },
  JOTL3127: { severity: "info", message: "nullable 不为 true, 无作用, 已移除", en: "nullable is not true and has no effect; removed" },
  JOTL3128: { severity: "info", message: "example 改写为 examples", en: "example rewritten to examples" },
  JOTL3129: { severity: "info", message: "format: \"byte\" 改写为 contentEncoding: \"base64\"", en: "format: \"byte\" rewritten to contentEncoding: \"base64\"" },
  JOTL3130: { severity: "info", message: "format: \"binary\" 改写为 contentMediaType: \"application/octet-stream\"", en: "format: \"binary\" rewritten to contentMediaType: \"application/octet-stream\"" },
  JOTL3131: { severity: "info", message: "根上写入 $schema: {dialect}", en: "Wrote $schema: {dialect} at the root" },

  // 32xx: 宽松模式
  JOTL3201: {
    severity: "warning",
    message: "{keyword} 由 {introduced} 引入, 声明版本 {declared} 中不存在; 已按 2020-12 语义接受",
    en: "{keyword} was introduced in {introduced} and does not exist in the declared version {declared}; accepted with 2020-12 semantics",
  },
  JOTL3202: {
    severity: "warning",
    message: "{keyword} 由 {introduced} 引入, 声明版本 {declared} 中不存在; acceptNewerKeywords 关闭, 已按声明版本忽略并移除",
    en: "{keyword} was introduced in {introduced} and does not exist in the declared version {declared}; acceptNewerKeywords is off, so it is ignored per the declared version and removed",
  },
  JOTL3203: {
    severity: "warning",
    message: "声明版本 {declared} 中出现旧版写法 {keyword}: {value}; 按值的类型识别为 draft-04 写法并改写",
    en: "Legacy form {keyword}: {value} appears in declared version {declared}; recognized as draft-04 form by value type and rewritten",
  },
  JOTL3204: { severity: "warning", message: "声明版本 {declared} 中出现旧版关键字 {keyword}; 按 {replacement} 处理", en: "Legacy keyword {keyword} appears in declared version {declared}; treated as {replacement}" },

  // 33xx: 冲突; onConflict 为 error 时为 error, 其余为 warning 并在 related 中写明处理方式
  JOTL3301: { severity: "error", message: "definitions 与 $defs 都定义了 {name}", en: "{name} is defined in both definitions and $defs" },
  JOTL3302: {
    severity: "error",
    message: "数组形式的 items 与 prefixItems 同时存在; items 在 {declared} 与 2020-12 中含义不同",
    en: "Array-form items and prefixItems are both present; items means different things in {declared} and 2020-12",
  },
  JOTL3303: {
    severity: "error",
    message: "{declared} 会忽略 $ref 旁的 {keywords}, 2020-12 中它们会生效, 校验结果会变",
    en: "{declared} ignores {keywords} next to $ref, but they take effect in 2020-12, so validation results will change",
  },
  JOTL3304: { severity: "error", message: "dependencies 与 {keyword} 都定义了 {name}", en: "{name} is defined in both dependencies and {keyword}" },
  JOTL3305: { severity: "error", message: "id(\"{id}\") 与 $id(\"{dollarId}\") 同时存在且值不同", en: "id (\"{id}\") and $id (\"{dollarId}\") are both present with different values" },
  JOTL3351: { severity: "info", message: "已按声明版本 {declared} 处理", en: "Handled per the declared version {declared}" },
  JOTL3352: { severity: "info", message: "已按 2020-12 处理", en: "Handled per 2020-12" },

  // 34xx: 多文档(跨文件 $ref)
  JOTL3401: { severity: "error", message: "加载文档失败: {uri}", en: "Failed to load document: {uri}" },
  JOTL3402: { severity: "error", message: "文档加载回调抛出异常: {uri}", en: "Document loader callback threw: {uri}" },
} as const;

export type UpgradeDiagnosticCode = keyof typeof UPGRADE_DIAGNOSTICS;

export const upgradeDiagnostic = defineDiagnostics(UPGRADE_DIAGNOSTICS);

/** 只取代码表中的消息文字, 用于 `related` 等不需要完整诊断的位置. */
export function upgradeMessage(
  code: UpgradeDiagnosticCode,
  params: Readonly<Record<string, string | number>> = {},
): string {
  const def: { message: string; en?: string } = UPGRADE_DIAGNOSTICS[code];
  return formatMessage(getLocale() === "en" && def.en !== undefined ? def.en : def.message, params);
}
