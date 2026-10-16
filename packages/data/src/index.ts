// 按 JSON Schema 生成默认数据, 校验, 迁移与 Mock.
import type { DataApi } from "@jotl/core";
import { fillDefaults, getDefaults } from "./defaults.js";
import { migrate } from "./migrate.js";
import { mock } from "./mock.js";
import { validate } from "./validate.js";

export { DATA_DIAGNOSTICS, DATA_TEXT, DATA_TEXT_EN, dataDiagnostic, dataText, type DataText, type LocaleOptions } from "./diagnostics.js";
export { COLOR_PATTERN } from "./ajv-instance.js";
export type { SubschemaOptions } from "./schema-resolver.js";
export { fillDefaults, getDefaults, migrate, mock, validate };

/** CT6 的五个函数, 供按 DataApi 注入的调用方使用. */
export const dataApi: DataApi = { getDefaults, fillDefaults, validate, migrate, mock };
