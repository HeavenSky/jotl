// migrate-schema 命令: 自动判定输入是凤蝶源码, 凤蝶 toJson JSON 还是常规 JSON Schema, 迁移为 Jotl(默认)或 2020-12 JSON.
import { type ConflictPolicy, type MigrateInputKind, type SchemaVersion, type UmoJson, detectMigrateInput, migrateFengdie } from "@jotl/convert";
import { print } from "@jotl/core";
import { type Command, OUT_OPTION, assertOutputDistinct, toJsonText, writeOutput } from "../command.js";
import { cliDiagnostic } from "../diagnostics.js";
import { SCHEMA_VERSION_OPTION, parseJsonInput, readInput, upgradeJson } from "../inputs.js";
import { cliText } from "../messages.js";
import { UsageError } from "../report.js";

/** 只对常规 JSON Schema 输入生效的选项. */
const JSON_SCHEMA_ONLY = ["schema-version", "accept-newer-keywords", "on-conflict"] as const;

export const migrateSchemaCommand: Command = {
  name: "migrate-schema",
  options: {
    to: { type: "string", choices: ["jotl", "schema"] },
    out: OUT_OPTION,
    "schema-version": SCHEMA_VERSION_OPTION,
    "accept-newer-keywords": { type: "string", choices: ["true", "false"] },
    "on-conflict": { type: "string", choices: ["error", "preferDeclared", "preferLatest"] },
  },
  positionals: { names: ["<file>"] },
  execute(ctx, args) {
    const [file = ""] = args.positionals;
    const out = args.strings.get("out");
    const to = (args.strings.get("to") ?? "jotl") as "jotl" | "schema";
    assertOutputDistinct("migrate-schema", ctx.io, out, [file]);

    const text = readInput(ctx, file);
    if (text === undefined) return;
    const detection = detectMigrateInput(text);
    const kindLabel = cliText().migrateInputKinds[detection.kind as MigrateInputKind];
    if (detection.kind !== "json-schema") {
      const option = JSON_SCHEMA_ONLY.find((name) => args.strings.has(name));
      if (option !== undefined) throw new UsageError(cliDiagnostic("JOTL9013", { option: `--${option}`, file, kind: kindLabel }), "migrate-schema");
    }
    ctx.reporter.report([cliDiagnostic("JOTL9055", { kind: kindLabel, reason: detection.reason })], { file });

    if (detection.kind !== "json-schema") {
      const result = migrateFengdie(detection.kind === "fengdie" ? text : (detection.json as UmoJson), file);
      ctx.reporter.report(result.diagnostics, { file });
      if (to === "schema" && result.schema !== undefined) writeOutput(ctx, toJsonText(result.schema), out);
      if (to === "jotl" && result.jotl !== undefined) writeOutput(ctx, result.jotl, out);
      return;
    }

    let json = detection.json;
    if (json === undefined) {
      const parsed = parseJsonInput(ctx, file, text);
      if (!parsed.ok) return;
      json = parsed.value;
    }
    const version = args.strings.get("schema-version") as SchemaVersion | undefined;
    const accept = args.strings.get("accept-newer-keywords");
    // 输出 Jotl 时与 convert 一致, 冲突默认按声明版本处理; 输出 schema 时沿用升级的默认: 报错.
    const onConflict = (args.strings.get("on-conflict") as ConflictPolicy | undefined) ?? (to === "jotl" ? "preferDeclared" : "error");
    const schema = upgradeJson(ctx, file, json, {
      showChanges: to === "schema",
      onConflict,
      ...(version === undefined ? {} : { version }),
      ...(accept === undefined ? {} : { acceptNewerKeywords: accept === "true" }),
    });
    if (schema === undefined) return;
    if (to === "schema") {
      writeOutput(ctx, toJsonText(schema), out);
      return;
    }
    const printed = print(schema);
    ctx.reporter.report(printed.diagnostics, { file });
    if (printed.value !== undefined) writeOutput(ctx, printed.value, out);
  },
};
