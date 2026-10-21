// check 命令: 只报告诊断; JSON Schema 另检查升级后的 schema 能否用于校验.
import type { SchemaVersion } from "@jotl/convert";
import { validate } from "@jotl/data";
import type { Command } from "../command.js";
import { CONFIG_OPTIONS, configResolver } from "../config.js";
import {
	SCHEMA_VERSION_OPTION,
	assertSingleStdin,
	loadSchema,
	resolveSchemaFormat,
} from "../inputs.js";

export const checkCommand: Command = {
	name: "check",
	options: { "schema-version": SCHEMA_VERSION_OPTION, ...CONFIG_OPTIONS },
	positionals: { names: ["<file...>"], variadic: true },
	execute(ctx, args) {
		const files = args.positionals.map(file => ({
			file,
			format: resolveSchemaFormat("check", file),
		}));
		assertSingleStdin("check", args.positionals);
		const version = args.strings.get("schema-version") as SchemaVersion | undefined;
		const config = configResolver("check", ctx, args);
		for (const { file, format } of files) {
			const loaded = loadSchema(ctx, file, format, {
				showChanges: false,
				config,
				...(version === undefined ? {} : { version }),
			});
			if (loaded === undefined || loaded.format !== "schema") continue;
			// 数据取什么都行: 只关心 schema 能否编译(JOTL4017), 校验结论丢弃.
			const probe = validate(loaded.schema, null);
			if (probe.value === undefined) ctx.reporter.report(probe.diagnostics, loaded.origin);
		}
	},
};
