// convert 命令: Jotl, JSON Schema, TS 声明之间任意互转, 中间统一为 2020-12 schema.
import { print } from "@jotl/core";
import { schemaToTs } from "@jotl/convert";
import type { ConflictPolicy, SchemaVersion } from "@jotl/convert";
import { type Command, OUT_OPTION, assertOutputDistinct, toJsonText, writeOutput } from "../command.js";
import { CONFIG_OPTIONS, configResolver } from "../config.js";
import { cliDiagnostic } from "../diagnostics.js";
import {
  FORMAT_OPTION,
  type InputFormat,
  SCHEMA_VERSION_OPTION,
  STDIN,
  detectFormatWithTs,
  loadSchema,
  resolveFormat,
} from "../inputs.js";
import { UsageError } from "../report.js";
import { assertTypiaTarget } from "./typia.js";

export const convertCommand: Command = {
  name: "convert",
  options: {
    to: FORMAT_OPTION,
    from: FORMAT_OPTION,
    "schema-version": SCHEMA_VERSION_OPTION,
    "on-conflict": { type: "string", choices: ["error", "preferDeclared", "preferLatest"] },
    out: OUT_OPTION,
    "typia-tags": { type: "boolean" },
    ...CONFIG_OPTIONS,
  },
  positionals: { names: ["<input>"] },
  execute(ctx, args) {
    const [file = ""] = args.positionals;
    const to = args.strings.get("to") as InputFormat | undefined;
    if (to === undefined) throw new UsageError(cliDiagnostic("JOTL9006", { name: "--to" }), "convert");
    const out = args.strings.get("out");
    const typiaTags = args.flags.has("typia-tags");
    assertTypiaTarget("convert", typiaTags, to);
    const given = args.strings.get("from") as InputFormat | undefined;
    const from = given === undefined && file === STDIN ? undefined : resolveFormat("convert", file, given, true);
    assertOutputDistinct("convert", ctx.io, out, [file]);

    const version = args.strings.get("schema-version") as SchemaVersion | undefined;
    // 转换要保留原 schema 的含义, 新旧语义冲突时默认按声明版本处理; migrate-schema --to schema 默认仍报错.
    const onConflict = (args.strings.get("on-conflict") as ConflictPolicy | undefined) ?? "preferDeclared";
    const detect = (text: string): InputFormat => {
      const format = detectFormatWithTs(text);
      if (format === undefined) throw new UsageError(cliDiagnostic("JOTL9016", { file }), "convert");
      return format;
    };
    const config = configResolver("convert", ctx, args);
    const flags = { showChanges: false, onConflict, config, ...(version === undefined ? {} : { version }) };
    const loaded = loadSchema(ctx, file, from, flags, detect);
    if (loaded === undefined) return;
    if (to === "schema") {
      writeOutput(ctx, toJsonText(loaded.schema), out);
      return;
    }
    const tsOptions = loaded.defaultExport === undefined ? { typiaTags } : { typiaTags, defaultExport: loaded.defaultExport };
    const printOptions = loaded.defaultExport === undefined ? {} : { defaultExport: loaded.defaultExport };
    const result = to === "ts" ? schemaToTs(loaded.schema, tsOptions) : print(loaded.schema, printOptions);
    ctx.reporter.report(result.diagnostics, loaded.origin);
    if (result.value !== undefined) writeOutput(ctx, result.value, out);
  },
};
