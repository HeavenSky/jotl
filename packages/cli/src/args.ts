// 子命令参数解析: 基于 node:util 的 parseArgs 取记号, 再按命令声明自行校验, 错误转为用法诊断.
import { parseArgs } from "node:util";
import { cliDiagnostic } from "./diagnostics.js";
import type { CommandName } from "./messages.js";
import { UsageError } from "./report.js";

export interface OptionSpec {
	type: "string" | "boolean";
	short?: string;
	/** string 选项的可选取值. */
	choices?: readonly string[];
}

export interface PositionalSpec {
	/** 帮助中的参数名, 用于缺少参数的消息; 最后一个可重复时 variadic 为 true. */
	names: readonly string[];
	variadic?: boolean;
}

export interface ParsedArgs {
	positionals: string[];
	strings: ReadonlyMap<string, string>;
	flags: ReadonlySet<string>;
	/** 是否带了 -h / --help; 为 true 时其余参数不做校验. */
	help: boolean;
}

const HELP_OPTION = "help";
const HELP_SHORT = "h";

function usage(command: CommandName, ...args: Parameters<typeof cliDiagnostic>): UsageError {
	return new UsageError(cliDiagnostic(...args), command);
}

export function parseCommandArgs(
	command: CommandName,
	argv: readonly string[],
	options: Readonly<Record<string, OptionSpec>>,
	positionals: PositionalSpec
): ParsedArgs {
	const config: Record<string, { type: "string" | "boolean"; short?: string }> = {
		[HELP_OPTION]: { type: "boolean", short: HELP_SHORT },
	};
	for (const [name, spec] of Object.entries(options)) {
		config[name] =
			spec.short === undefined ? { type: spec.type } : { type: spec.type, short: spec.short };
	}
	// strict 关闭后 parseArgs 不抛英文错误, 未知选项与缺值都留在 tokens 中由下面逐条判定.
	const { tokens } = parseArgs({
		args: [...argv],
		options: config,
		strict: false,
		allowPositionals: true,
		tokens: true,
	});

	if (tokens.some(t => t.kind === "option" && t.name === HELP_OPTION)) {
		return { positionals: [], strings: new Map(), flags: new Set(), help: true };
	}

	const strings = new Map<string, string>();
	const flags = new Set<string>();
	const values: string[] = [];
	for (const token of tokens) {
		if (token.kind === "positional") {
			values.push(token.value);
			continue;
		}
		if (token.kind !== "option") continue;
		const spec = options[token.name];
		if (spec === undefined) throw usage(command, "JOTL9002", { option: token.rawName });
		if (spec.type === "boolean") {
			if (token.value !== undefined)
				throw usage(command, "JOTL9004", { option: token.rawName });
			flags.add(token.name);
			continue;
		}
		// 非严格模式下 `--out --write` 会把 `--write` 当作 --out 的值.
		const swallowedOption =
			token.inlineValue === false &&
			token.value?.startsWith("-") === true &&
			token.value !== "-";
		if (token.value === undefined || swallowedOption)
			throw usage(command, "JOTL9003", { option: token.rawName });
		if (spec.choices && !spec.choices.includes(token.value)) {
			throw usage(command, "JOTL9005", {
				option: token.rawName,
				value: token.value,
				choices: spec.choices.join(", "),
			});
		}
		strings.set(token.name, token.value);
	}

	const required = positionals.names.length;
	if (values.length < required) {
		throw usage(command, "JOTL9006", { name: positionals.names[values.length] ?? "" });
	}
	if (!positionals.variadic && values.length > required) {
		throw usage(command, "JOTL9007", { value: values[required] ?? "" });
	}
	return { positionals: values, strings, flags, help: false };
}
