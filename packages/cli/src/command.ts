// 子命令的声明形状与共用的输出步骤: 结果写到 stdout 或 --out, 写文件前拒绝覆盖输入.
import type { OptionSpec, ParsedArgs, PositionalSpec } from "./args.js";
import { cliDiagnostic } from "./diagnostics.js";
import type { CliIo } from "./io.js";
import type { CommandName } from "./messages.js";
import { type Reporter, UsageError, fsReason } from "./report.js";

export interface CommandContext {
	io: CliIo;
	reporter: Reporter;
}

export interface Command {
	name: CommandName;
	options: Readonly<Record<string, OptionSpec>>;
	positionals: PositionalSpec;
	/** 用法错误抛 UsageError; 其余问题经 reporter 报告, 有错误级诊断时退出码为 1. */
	execute(ctx: CommandContext, args: ParsedArgs): void;
}

export const OUT_OPTION: OptionSpec = { type: "string" };

/** --out 指向任一输入文件时报用法错误; 在读取输入之前调用. */
export function assertOutputDistinct(
	command: CommandName,
	io: CliIo,
	out: string | undefined,
	inputs: readonly string[]
): void {
	if (out === undefined) return;
	const input = inputs.find(file => io.isSameFile(out, file));
	if (input !== undefined)
		throw new UsageError(cliDiagnostic("JOTL9008", { out, input }), command);
}

/** 写到 out 指定的文件, 未指定时写到 stdout; 写文件失败报 JOTL9051. */
export function writeOutput(ctx: CommandContext, text: string, out: string | undefined): void {
	if (out === undefined) {
		ctx.io.stdout(text);
		return;
	}
	writeFileReported(ctx, out, text);
}

export function writeFileReported(ctx: CommandContext, file: string, text: string): void {
	try {
		ctx.io.writeFile(file, text);
	} catch (error) {
		ctx.reporter.report([cliDiagnostic("JOTL9051", { file, reason: fsReason(error) })], {
			file,
		});
	}
}

export function toJsonText(value: unknown): string {
	return JSON.stringify(value, null, 2) + "\n";
}
