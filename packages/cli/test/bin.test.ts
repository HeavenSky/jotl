// 以子进程运行构建产物 dist/bin.js, 验证可执行入口; 需先执行 `tsc -p packages/cli`.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, SHARED_FIXTURES, readRepoFile } from "./helpers.js";

const BIN = join(REPO_ROOT, "packages/cli/dist/bin.js");
const TIMEOUT_MS = 20_000;

/** 默认固定 JOTL_LANG=zh-CN, 中文断言不受开发机 LANG 影响. */
function runBin(args: string[], env: Record<string, string> = { JOTL_LANG: "zh-CN" }) {
  if (!existsSync(BIN)) throw new Error("缺少 packages/cli/dist/bin.js, 请先运行 pnpm exec tsc -p packages/cli");
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    env: { ...process.env, ...env },
  });
}

describe("dist/bin.js", () => {
  it("首行是 node shebang", () => {
    expect(readRepoFile("packages/cli/dist/bin.js").startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  it("--version 输出版本号, 退出码 0", () => {
    const version = (JSON.parse(readRepoFile("packages/cli/package.json")) as { version: string }).version;
    const r = runBin(["--version"]);
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(`${version}\n`);
    expect(r.stderr).toBe("");
  });

  it("有错误级诊断时进程退出码为 1", () => {
    const r = runBin(["check", `${SHARED_FIXTURES}/016-errors/source.jotl`]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`${SHARED_FIXTURES}/016-errors/source.jotl:2:9 JOTL1004 错误: `);
  });

  it("从进程环境变量取输出语言: JOTL_LANG=en 时帮助为英文", () => {
    const r = runBin(["--help"], { JOTL_LANG: "en" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Usage: jotl <command> [options]");
  });

  it("用法错误时进程退出码为 2", () => {
    const r = runBin(["compile"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
  });
});
