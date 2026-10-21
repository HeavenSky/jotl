// 用缓存的 Ajv 校验函数校验数据, 错误转为带数据指针的中文 Diagnostic.
import { fail, ok, type JsonSchema, type Result } from '@jotl/core';
import { compileSchema, compileSubschema } from './ajv-instance.js';
import { dataDiagnostic, dataText, withLocale, type LocaleOptions } from './diagnostics.js';
import { convertErrors } from './error-convert.js';
import { subschemaAt, type SubschemaOptions } from './schema-resolver.js';

export function validate(
  schema: JsonSchema,
  data: unknown,
  opts?: SubschemaOptions & LocaleOptions
): Result<{ valid: boolean }> {
  return withLocale(opts?.locale, () => validateIn(schema, data, opts));
}

function validateIn(schema: JsonSchema, data: unknown, opts: SubschemaOptions | undefined): Result<{ valid: boolean }> {
  const target = subschemaAt(schema, opts?.at);
  if (target === undefined) return fail([dataDiagnostic('JOTL4018', { name: 'at', value: JSON.stringify(opts?.at) })]);
  const compiled = target === schema ? compileSchema(schema) : compileSubschema(schema, target);
  if (!compiled.ok) {
    // Ajv 原文是英文, 放进 related 单独成行, 不拼进中文主句.
    const detail = compiled.error instanceof Error ? compiled.error.message : dataText().compileUnknown;
    return fail([
      dataDiagnostic('JOTL4017', {}, { related: [{ message: detail, location: { kind: 'pointer', pointer: '' } }] }),
    ]);
  }
  if (compiled.validate(data)) return ok({ valid: true });
  // Ajv 在下一次调用时覆盖 errors, 必须先取走.
  const errors = [...(compiled.validate.errors ?? [])];
  return ok({ valid: false }, convertErrors(target, errors, schema));
}
