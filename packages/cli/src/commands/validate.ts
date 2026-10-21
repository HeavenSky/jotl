// validate 命令: 按 schema 校验 JSON 数据文件, 每个文件的结论写 stdout, 校验错误写 stderr.
import {
	type Diagnostic,
	type JsonPointer,
	formatMessage,
	jsonPointerOffsets,
	parentPointer,
} from "@jotl/core";
import { validate } from "@jotl/data";
import type { SchemaVersion } from "@jotl/convert";
import type { Command } from "../command.js";
import { CONFIG_OPTIONS, configResolver } from "../config.js";
import {
	SCHEMA_VERSION_OPTION,
	assertSingleStdin,
	loadSchema,
	parseJsonInput,
	rangeAt,
	readInput,
	resolveSchemaFormat,
} from "../inputs.js";
import { cliText } from "../messages.js";

/** 指针诊断附一条 related, 给出数据文件中的行列; 指针本身找不到时取最近的上级. */
function withDataLocation(
	diagnostics: readonly Diagnostic[],
	file: string,
	text: string
): Diagnostic[] {
	const offsets = jsonPointerOffsets(text);
	if (offsets === undefined) return [...diagnostics];
	return diagnostics.map(d => {
		if (d.location?.kind !== "pointer" || d.location.document !== undefined) return d;
		let pointer: JsonPointer | undefined = d.location.pointer;
		while (pointer !== undefined && !offsets.has(pointer)) pointer = parentPointer(pointer);
		const offset = pointer === undefined ? undefined : offsets.get(pointer);
		if (offset === undefined) return d;
		const related = {
			message: cliText().dataLocation,
			location: { kind: "source" as const, range: rangeAt(file, text, offset) },
		};
		return { ...d, related: [related, ...(d.related ?? [])] };
	});
}

export const validateCommand: Command = {
	name: "validate",
	options: { "schema-version": SCHEMA_VERSION_OPTION, ...CONFIG_OPTIONS },
	positionals: { names: ["<schema>", "<data...>"], variadic: true },
	execute(ctx, args) {
		const [schemaFile = "", ...dataFiles] = args.positionals;
		const format = resolveSchemaFormat("validate", schemaFile);
		assertSingleStdin("validate", args.positionals);
		const version = args.strings.get("schema-version") as SchemaVersion | undefined;
		const config = configResolver("validate", ctx, args);
		const loaded = loadSchema(ctx, schemaFile, format, {
			showChanges: false,
			config,
			...(version === undefined ? {} : { version }),
		});
		if (loaded === undefined) return;
		for (const file of dataFiles) {
			const text = readInput(ctx, file);
			if (text === undefined) continue;
			const parsed = parseJsonInput(ctx, file, text);
			if (!parsed.ok) continue;
			const result = validate(loaded.schema, parsed.value);
			if (result.value === undefined) {
				ctx.reporter.report(result.diagnostics, loaded.origin);
				return;
			}
			ctx.reporter.report(withDataLocation(result.diagnostics, file, text), { file });
			ctx.io.stdout(
				formatMessage(
					result.value.valid ? cliText().validatePassed : cliText().validateFailed,
					{ file }
				) + "\n"
			);
		}
	},
};
