// compile 命令: Jotl 源码编译为 JSON Schema 2020-12 或 TS 声明.
import { compile } from "@jotl/core";
import { schemaToTs } from "@jotl/convert";
import { type Command, OUT_OPTION, assertOutputDistinct, toJsonText, writeOutput } from "../command.js";
import { CONFIG_OPTIONS, configResolver } from "../config.js";
import { readInput } from "../inputs.js";
import { assertTypiaTarget } from "./typia.js";

export const compileCommand: Command = {
  name: "compile",
  options: {
    to: { type: "string", choices: ["schema", "ts"] },
    out: OUT_OPTION,
    "typia-tags": { type: "boolean" },
    ...CONFIG_OPTIONS,
  },
  positionals: { names: ["<file.jotl>"] },
  execute(ctx, args) {
    const [file = ""] = args.positionals;
    const to = args.strings.get("to") ?? "schema";
    const out = args.strings.get("out");
    const typiaTags = args.flags.has("typia-tags");
    assertTypiaTarget("compile", typiaTags, to);
    assertOutputDistinct("compile", ctx.io, out, [file]);
    const config = configResolver("compile", ctx, args);

    const text = readInput(ctx, file);
    if (text === undefined) return;
    const options = config(file);
    if (options === undefined) return;
    const compiled = compile(text, file, options);
    ctx.reporter.report(compiled.diagnostics, { file });
    if (compiled.value === undefined) return;
    if (to === "schema") {
      writeOutput(ctx, toJsonText(compiled.value.schema), out);
      return;
    }
    const { schema, defaultExport } = compiled.value;
    const ts = schemaToTs(schema, defaultExport === undefined ? { typiaTags } : { typiaTags, defaultExport });
    ctx.reporter.report(ts.diagnostics, { file, sourceMap: compiled.value.sourceMap });
    if (ts.value !== undefined) writeOutput(ctx, ts.value, out);
  },
};
