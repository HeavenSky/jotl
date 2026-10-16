// 读取本包 package.json 中的版本号, 供 --version 与帮助使用.
import { readFileSync } from "node:fs";

let cached: string | undefined;

export function cliVersion(): string {
  // src/ 与 dist/ 都与 package.json 相隔一级, 移动本文件所在目录会读错文件.
  cached ??= (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
  return cached;
}
