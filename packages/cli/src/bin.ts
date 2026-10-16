#!/usr/bin/env node
// jotl 可执行入口: 用 Node 进程的输入输出调用 run, 并把内部异常转为诊断输出.
import { cliDiagnostic } from "./diagnostics.js";
import { createNodeIo } from "./io.js";
import { cliText } from "./messages.js";
import { formatDiagnostic } from "./report.js";
import { EXIT_CODES, run } from "./run.js";

const io = createNodeIo();
try {
  process.exitCode = run(process.argv.slice(2), io, { env: process.env });
} catch (error) {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  io.stderr(formatDiagnostic(cliDiagnostic("JOTL9099", { detail }), { file: "jotl" }) + "\n" + cliText().internalErrorHint + "\n");
  process.exitCode = EXIT_CODES.error;
}
