// 项目配置 jotl.config.json: 从源文件所在目录向上找最近的一个(到 git 顶层或文件系统根为止), 换算为编译选项; --config 指定, --no-config 关闭.
import { dirname, join, relative, resolve } from "node:path";
import { type CompileOptions, JOTL_CONFIG_FILE, configCompileOptions, jsonPointerOffsets, readJotlConfig } from "@jotl/core";
import type { OptionSpec, ParsedArgs } from "./args.js";
import type { CommandContext } from "./command.js";
import { cliDiagnostic } from "./diagnostics.js";
import { STDIN, parseJsonInput, rangeAt, readInput } from "./inputs.js";
import type { CliIo } from "./io.js";
import type { CommandName } from "./messages.js";
import { UsageError } from "./report.js";

export const CONFIG_OPTIONS: Readonly<Record<string, OptionSpec>> = {
  config: { type: "string" },
  "no-config": { type: "boolean" },
};

/** 源文件 → 编译选项; 配置文件读取失败或不合法时已报告诊断并返回 undefined. */
export type ConfigResolver = (file: string) => CompileOptions | undefined;

/** start 为目录; 找不到时返回 undefined. */
export function findConfigFile(io: CliIo, start: string): string | undefined {
  let dir = resolve(io.cwd, start);
  for (;;) {
    const candidate = join(dir, JOTL_CONFIG_FILE);
    if (io.exists(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir || io.exists(join(dir, ".git"))) return undefined;
    dir = parent;
  }
}

function loadConfig(ctx: CommandContext, file: string): CompileOptions | undefined {
  const text = readInput(ctx, file);
  if (text === undefined) return undefined;
  const parsed = parseJsonInput(ctx, file, text);
  if (!parsed.ok) return undefined;
  const { config, issues } = readJotlConfig(parsed.value);
  if (issues.length === 0) return configCompileOptions(config.widgets);
  const offsets = jsonPointerOffsets(text);
  const diagnostics = issues.map(({ pointer, message }) => {
    const offset = offsets?.get(pointer);
    const location = offset === undefined
      ? { kind: "pointer" as const, pointer }
      : { kind: "source" as const, range: rangeAt(file, text, offset) };
    return cliDiagnostic("JOTL9056", { reason: message }, { location });
  });
  ctx.reporter.report(diagnostics, { file });
  return undefined;
}

/** 在读取输入之前调用; 同一配置文件只读一次. */
export function configResolver(command: CommandName, ctx: CommandContext, args: ParsedArgs): ConfigResolver {
  const given = args.strings.get("config");
  if (args.flags.has("no-config")) {
    if (given !== undefined) throw new UsageError(cliDiagnostic("JOTL9017", { option: "--config", conflicts: "--no-config" }), command);
    return () => ({});
  }
  const cache = new Map<string, CompileOptions | undefined>();
  return (file) => {
    const found = given === undefined ? findConfigFile(ctx.io, file === STDIN ? "." : dirname(file)) : undefined;
    const path = given ?? (found === undefined ? undefined : relative(ctx.io.cwd, found));
    if (path === undefined) return {};
    if (!cache.has(path)) cache.set(path, loadConfig(ctx, path));
    return cache.get(path);
  };
}
