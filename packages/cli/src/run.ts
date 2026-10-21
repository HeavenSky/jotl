// 命令行入口逻辑: 确定输出语言, 分派子命令, 处理全局 --help / --version / --lang, 把结果折算为退出码.
import { type Locale, formatMessage, getLocale, resolveLocale, setLocale } from '@jotl/core';
import { SCHEMA_VERSIONS } from '@jotl/convert';
import { parseCommandArgs } from './args.js';
import type { Command } from './command.js';
import { checkCommand } from './commands/check.js';
import { compileCommand } from './commands/compile.js';
import { convertCommand } from './commands/convert.js';
import { defaultsCommand } from './commands/defaults.js';
import { formatCommand } from './commands/format.js';
import { migrateSchemaCommand } from './commands/migrate-schema.js';
import { validateCommand } from './commands/validate.js';
import { cliDiagnostic } from './diagnostics.js';
import type { CliIo } from './io.js';
import { type CommandName, LOCALES, commandHelpTemplate, globalHelp, cliText } from './messages.js';
import { UsageError, createReporter, formatDiagnostic } from './report.js';
import { cliVersion } from './version.js';

export const EXIT_CODES = { ok: 0, error: 1, usage: 2 } as const;

export type CliEnv = Readonly<Record<string, string | undefined>>;

export interface RunOptions {
  /** 用于确定输出语言的环境变量; 不给时沿用当前全局语言(`getLocale()`), 可执行入口传 process.env. */
  env?: CliEnv;
}

const COMMANDS: Readonly<Record<CommandName, Command>> = {
  compile: compileCommand,
  convert: convertCommand,
  check: checkCommand,
  validate: validateCommand,
  defaults: defaultsCommand,
  'migrate-schema': migrateSchemaCommand,
  format: formatCommand,
};

const PROGRAM = 'jotl';
const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-v', '--version']);
const LANG_FLAG = '--lang';
const END_OF_OPTIONS = '--';
/** JOTL_LANG 之后按 POSIX 优先级取语言环境变量. */
const POSIX_LOCALE_VARS = ['LC_ALL', 'LC_MESSAGES', 'LANG'] as const;

/** 依次取 JOTL_LANG, LC_ALL, LC_MESSAGES, LANG 中第一个非空值交给 resolveLocale; `C` 与 `POSIX` 不以 zh 开头, 得到 en. */
export function localeFromEnv(env: CliEnv): Locale {
  for (const name of ['JOTL_LANG', ...POSIX_LOCALE_VARS]) {
    const value = env[name]?.trim();
    if (value) return resolveLocale(value);
  }
  return resolveLocale(undefined);
}

/** --lang 接受 zh 与 en 及其地区写法(如 `zh_CN`, `en-US`, 大小写不限), 交给 resolveLocale 归一; 其他语言是用法错误, 不能像环境变量那样回落为 en. */
function parseLangOption(value: string): Locale | undefined {
  return /^(?:zh|en)(?:[-_][\w.-]*)?$/i.test(value) ? resolveLocale(value) : undefined;
}

/** 从任意位置(`--` 之前)取出 `--lang <值>` 与 `--lang=<值>`, 多次出现时以最后一次为准; 返回其余参数. */
function extractLang(argv: readonly string[]): { rest: string[]; lang: Locale | undefined } {
  const rest: string[] = [];
  let lang: Locale | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === END_OF_OPTIONS) {
      rest.push(...argv.slice(i));
      break;
    }
    let value: string | undefined;
    if (arg === LANG_FLAG) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-'))
        throw new UsageError(cliDiagnostic('JOTL9003', { option: LANG_FLAG }), undefined);
      value = next;
      i += 1;
    } else if (arg.startsWith(LANG_FLAG + '=')) {
      value = arg.slice(LANG_FLAG.length + 1);
    } else {
      rest.push(arg);
      continue;
    }
    const locale = parseLangOption(value);
    if (locale === undefined) {
      throw new UsageError(
        cliDiagnostic('JOTL9005', { option: LANG_FLAG, value, choices: LOCALES.join(', ') }),
        undefined
      );
    }
    lang = locale;
  }
  return { rest, lang };
}

function isCommandName(name: string): name is CommandName {
  return Object.hasOwn(COMMANDS, name);
}

function commandHelp(name: CommandName): string {
  return formatMessage(commandHelpTemplate(name), { versions: SCHEMA_VERSIONS.join(', ') });
}

function reportUsage(io: CliIo, error: UsageError): number {
  io.stderr(formatDiagnostic(error.diagnostic, { file: PROGRAM }) + '\n');
  const hint =
    error.command === undefined
      ? cliText().globalUsageHint
      : formatMessage(cliText().usageHint, { command: error.command });
  io.stderr(hint + '\n');
  return EXIT_CODES.usage;
}

function dispatch(argv: readonly string[], io: CliIo): number {
  const [first, ...rest] = argv;
  if (first === undefined) {
    io.stderr(formatMessage(globalHelp(), { version: cliVersion() }));
    throw new UsageError(cliDiagnostic('JOTL9012'), undefined);
  }
  if (HELP_FLAGS.has(first)) {
    io.stdout(formatMessage(globalHelp(), { version: cliVersion() }));
    return EXIT_CODES.ok;
  }
  if (VERSION_FLAGS.has(first)) {
    io.stdout(cliVersion() + '\n');
    return EXIT_CODES.ok;
  }
  if (first === 'help') {
    const [topic] = rest;
    if (topic === undefined) {
      io.stdout(formatMessage(globalHelp(), { version: cliVersion() }));
      return EXIT_CODES.ok;
    }
    if (!isCommandName(topic)) throw new UsageError(cliDiagnostic('JOTL9001', { name: topic }), undefined);
    io.stdout(commandHelp(topic));
    return EXIT_CODES.ok;
  }
  if (first.startsWith('-')) throw new UsageError(cliDiagnostic('JOTL9002', { option: first }), undefined);
  if (!isCommandName(first)) throw new UsageError(cliDiagnostic('JOTL9001', { name: first }), undefined);

  const command = COMMANDS[first];
  const args = parseCommandArgs(command.name, rest, command.options, command.positionals);
  if (args.help) {
    io.stdout(commandHelp(command.name));
    return EXIT_CODES.ok;
  }
  const reporter = createReporter(io);
  command.execute({ io, reporter }, args);
  return reporter.errorCount > 0 ? EXIT_CODES.error : EXIT_CODES.ok;
}

/**
 * 执行一次命令行调用并返回退出码: 0 成功, 1 有错误级诊断, 2 用法错误; 不调用 process.exit.
 * 输出语言取 `--lang`, 其次 options.env; 调用期间写入全局语言(`setLocale`), 返回或抛出前恢复为调用前的值.
 */
export function run(argv: readonly string[], io: CliIo, options: RunOptions = {}): number {
  const previous = getLocale();
  setLocale(options.env === undefined ? previous : localeFromEnv(options.env));
  try {
    const { rest, lang } = extractLang(argv);
    if (lang !== undefined) setLocale(lang);
    return dispatch(rest, io);
  } catch (error) {
    if (error instanceof UsageError) return reportUsage(io, error);
    throw error;
  } finally {
    setLocale(previous);
  }
}
