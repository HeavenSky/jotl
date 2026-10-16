// 数据能力接口(CT6)的类型; 实现在 @jotl/data.
import type { Result } from "./diagnostic.js";
import type { JsonPointer } from "./json-pointer.js";
import type { JsonSchema } from "./json-schema.js";
import type { Locale } from "./locale.js";

export interface DefaultsOptions {
  strategy: "explicit" | "required" | "all";
  arrayItems: "minItems" | "none";
  oneOf: "first" | "firstWithDefault";
  maxDepth: number;
}

export const DEFAULT_DEFAULTS_OPTIONS: Readonly<DefaultsOptions> = {
  strategy: "explicit",
  arrayItems: "minItems",
  oneOf: "firstWithDefault",
  maxDepth: 3,
};

export interface MockOptions {
  seed?: number;
}

/** 本次调用产生的诊断与消息所用语言; 缺省取全局当前语言. */
type LocaleOption = { locale?: Locale };

export type GetDefaults = (schema: JsonSchema, opts?: Partial<DefaultsOptions> & LocaleOption) => Result<unknown>;
export type FillDefaults = (
  schema: JsonSchema,
  data: unknown,
  opts?: Partial<DefaultsOptions> & LocaleOption,
) => Result<{ data: unknown; filled: JsonPointer[] }>;
/** 错误转为 Diagnostic, location.kind = "pointer". */
export type Validate = (schema: JsonSchema, data: unknown, opts?: LocaleOption) => Result<{ valid: boolean }>;
export type Migrate = (
  schema: JsonSchema,
  data: unknown,
  opts?: LocaleOption,
) => Result<{ data: unknown; changed: JsonPointer[] }>;
export type Mock = (schema: JsonSchema, opts?: MockOptions & LocaleOption) => Result<unknown>;

export interface DataApi {
  getDefaults: GetDefaults;
  fillDefaults: FillDefaults;
  validate: Validate;
  migrate: Migrate;
  mock: Mock;
}
