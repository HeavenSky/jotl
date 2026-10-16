// jotl 命令行的公开 API: 可注入输入输出的 run, Node 端口实现与诊断代码表.
export { run, localeFromEnv, EXIT_CODES, type CliEnv, type RunOptions } from "./run.js";
export { createNodeIo, type CliIo } from "./io.js";
export { CLI_DIAGNOSTICS, type CliDiagnosticCode } from "./diagnostics.js";
export { formatDiagnostic, type DiagnosticOrigin } from "./report.js";
export { COMMAND_NAMES, type CommandName } from "./messages.js";
