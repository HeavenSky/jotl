// 测试辅助: 内存版 CliIo(读取回落到真实文件, 写入只进内存), 以及运行 run 并收集输出与退出码.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CliEnv, CliIo } from "../src/index.js";
import { run } from "../src/index.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(TEST_DIR, "../../..");
/** 相对仓库根的本包测试样例目录. */
export const CLI_FIXTURES = "packages/cli/test/fixtures";
/** 相对仓库根的共享样例目录. */
export const SHARED_FIXTURES = "fixtures";

export interface MemoryIo extends CliIo {
  /** 写入过的文件, 键为绝对路径. */
  readonly files: Map<string, string>;
}

export interface MemoryIoOptions {
  /** 预置文件, 键为相对仓库根的路径. */
  files?: Record<string, string>;
  /** 写入这些相对路径时抛出带 code 的错误. */
  failWrites?: Record<string, string>;
  /** stdin 的内容; 未给出时读取 stdin 抛出 ENOENT. */
  stdin?: string;
}

export function createMemoryIo(options: MemoryIoOptions = {}, sink: { out: string[]; err: string[] }): MemoryIo {
  const files = new Map<string, string>();
  for (const [path, text] of Object.entries(options.files ?? {})) files.set(resolve(REPO_ROOT, path), text);
  const failWrites = new Map(Object.entries(options.failWrites ?? {}).map(([p, code]) => [resolve(REPO_ROOT, p), code]));
  return {
    cwd: REPO_ROOT,
    files,
    stdout: (text) => void sink.out.push(text),
    stderr: (text) => void sink.err.push(text),
    readFile(path) {
      const key = resolve(REPO_ROOT, path);
      return files.get(key) ?? readFileSync(key, "utf8");
    },
    writeFile(path, text) {
      const key = resolve(REPO_ROOT, path);
      const code = failWrites.get(key);
      if (code !== undefined) throw Object.assign(new Error(`模拟写入失败 ${code}`), { code });
      files.set(key, text);
    },
    exists: (path) => {
      const key = resolve(REPO_ROOT, path);
      return files.has(key) || existsSync(key);
    },
    isSameFile: (a, b) => resolve(REPO_ROOT, a) === resolve(REPO_ROOT, b),
    readStdin() {
      if (options.stdin === undefined) throw Object.assign(new Error("模拟 stdin 不可用"), { code: "ENOENT" });
      return options.stdin;
    },
  };
}

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  io: MemoryIo;
}

export interface CliOptions extends MemoryIoOptions {
  /** 传给 run 的环境变量; 默认只有 JOTL_LANG=zh-CN, 输出语言固定为中文, 不受开发机 LANG 影响. */
  env?: CliEnv;
}

export function cli(argv: string[], options: CliOptions = {}): CliResult {
  const sink = { out: [] as string[], err: [] as string[] };
  const io = createMemoryIo(options, sink);
  const code = run(argv, io, { env: options.env ?? { JOTL_LANG: "zh-CN" } });
  return { code, stdout: sink.out.join(""), stderr: sink.err.join(""), io };
}

/** 读取写入内存的文件; 路径相对仓库根. */
export function written(result: CliResult, path: string): string | undefined {
  return result.io.files.get(resolve(REPO_ROOT, path));
}

export function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

export interface DiagnosticLine {
  /** `文件:行:列`, `文件#指针` 或 `文件`. */
  location: string;
  code: string;
  severity: string;
  message: string;
}

const DIAGNOSTIC_LINE = /^(\S+) (JOTL\d{4}) (错误|警告|提示|error|warning|info): (.*)$/;

/** 解析 stderr 中的诊断行; 缩进的 related 行与提示行不计入. */
export function diagnosticLines(stderr: string): DiagnosticLine[] {
  const lines: DiagnosticLine[] = [];
  for (const line of stderr.split("\n")) {
    const match = DIAGNOSTIC_LINE.exec(line);
    if (match) lines.push({ location: match[1] ?? "", code: match[2] ?? "", severity: match[3] ?? "", message: match[4] ?? "" });
  }
  return lines;
}

export function codesOf(stderr: string): string[] {
  return diagnosticLines(stderr).map((d) => d.code);
}
