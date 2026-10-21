// jotl 命令行的诊断代码表(JOTL9xxx): 90xx 为用法错误(退出码 2), 905x 为运行时的文件与输入问题.
import { defineDiagnostics } from '@jotl/core';

export const CLI_DIAGNOSTICS = {
  JOTL9001: { severity: 'error', message: '未知命令 `{name}`', en: 'unknown command `{name}`' },
  JOTL9002: { severity: 'error', message: '未知选项 `{option}`', en: 'unknown option `{option}`' },
  JOTL9003: { severity: 'error', message: '选项 `{option}` 缺少取值', en: 'option `{option}` requires a value' },
  JOTL9004: { severity: 'error', message: '选项 `{option}` 不接受取值', en: 'option `{option}` does not take a value' },
  JOTL9005: {
    severity: 'error',
    message: '选项 `{option}` 的取值 `{value}` 无效, 可选: {choices}',
    en: 'invalid value `{value}` for option `{option}`; choices: {choices}',
  },
  JOTL9006: { severity: 'error', message: '缺少参数 {name}', en: 'missing argument {name}' },
  JOTL9007: { severity: 'error', message: '多余的参数 `{value}`', en: 'unexpected argument `{value}`' },
  JOTL9008: {
    severity: 'error',
    message: '输出路径 `{out}` 与输入文件 `{input}` 相同; 不会覆盖输入文件',
    en: 'output path `{out}` is the same as input file `{input}`; the input file will not be overwritten',
  },
  JOTL9009: {
    severity: 'error',
    message: '无法按扩展名判断 `{file}` 的格式; 支持 .jotl, .json, .ts(含 .d.ts)',
    en: 'cannot determine the format of `{file}` from its extension; supported: .jotl, .json, .ts (including .d.ts)',
  },
  JOTL9010: {
    severity: 'error',
    message: '无法按扩展名判断 `{file}` 的格式; 支持 .jotl, .json, .ts(含 .d.ts), 或用 --from 指定 jotl, schema, ts',
    en: 'cannot determine the format of `{file}` from its extension; supported: .jotl, .json, .ts (including .d.ts), or use --from jotl, schema, ts',
  },
  JOTL9011: {
    severity: 'error',
    message: '选项 `{option}` 只能与 `{requires}` 一起使用',
    en: 'option `{option}` can only be used with `{requires}`',
  },
  JOTL9012: { severity: 'error', message: '缺少命令', en: 'missing command' },
  JOTL9013: {
    severity: 'error',
    message: '选项 `{option}` 只适用于常规 JSON Schema 输入; `{file}` 已判定为{kind}',
    en: 'option `{option}` applies only to plain JSON Schema input; `{file}` was detected as {kind}',
  },
  JOTL9014: {
    severity: 'error',
    message: '从 stdin 读入(`-`)时不能使用选项 `{option}`',
    en: 'option `{option}` cannot be used when reading from stdin (`-`)',
  },
  JOTL9015: {
    severity: 'error',
    message: '同一命令中只能有一个参数写 `-`(stdin)',
    en: 'at most one argument per command may be `-` (stdin)',
  },
  JOTL9016: {
    severity: 'error',
    message: '无法按内容判断 `{file}` 的格式; 请用 --from 指定 jotl, schema, ts',
    en: 'cannot determine the format of `{file}` from its content; use --from jotl, schema, ts',
  },
  JOTL9017: {
    severity: 'error',
    message: '选项 `{option}` 不能与 `{conflicts}` 一起使用',
    en: 'option `{option}` cannot be used with `{conflicts}`',
  },

  JOTL9050: {
    severity: 'error',
    message: '无法读取文件 `{file}`: {reason}',
    en: 'cannot read file `{file}`: {reason}',
  },
  JOTL9051: {
    severity: 'error',
    message: '无法写入文件 `{file}`: {reason}',
    en: 'cannot write file `{file}`: {reason}',
  },
  JOTL9052: { severity: 'error', message: '不是合法的 JSON: {detail}', en: 'invalid JSON: {detail}' },
  JOTL9053: {
    severity: 'warning',
    message: '未声明 $schema, 也无法按特征推断版本; 按 2020-12 处理, 可用 --schema-version 指定',
    en: '$schema is not declared and the version cannot be inferred from its features; treating as 2020-12, use --schema-version to specify',
  },
  JOTL9054: {
    severity: 'info',
    message: 'schema 中没有可生成的默认数据, 未输出',
    en: 'the schema has no default data to generate; nothing was output',
  },
  JOTL9055: { severity: 'info', message: '按{kind}处理: {reason}', en: 'treating as {kind}: {reason}' },
  JOTL9056: { severity: 'error', message: '配置文件不合法: {reason}', en: 'invalid config file: {reason}' },
  JOTL9099: { severity: 'error', message: '内部错误: {detail}', en: 'internal error: {detail}' },
} as const;

export type CliDiagnosticCode = keyof typeof CLI_DIAGNOSTICS;

export const cliDiagnostic = defineDiagnostics(CLI_DIAGNOSTICS);
