// 命令行的输入输出端口: run 只经此接口读写, 便于测试注入; 另提供基于 Node 进程与文件系统的实现.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CliIo {
	/** 解析相对路径的基准目录. */
	readonly cwd: string;
	stdout(text: string): void;
	stderr(text: string): void;
	/** 读取 UTF-8 文本; 失败时抛出带 `code` 的错误(与 Node 的 fs 错误一致). */
	readFile(path: string): string;
	/** 读取 stdin 的全部 UTF-8 文本; 输入文件参数为 `-` 时使用. */
	readStdin(): string;
	/** 写入 UTF-8 文本; 失败时抛出带 `code` 的错误. */
	writeFile(path: string, text: string): void;
	/** 路径(文件或目录)是否存在; 用于查找 jotl.config.json 与 git 顶层. */
	exists(path: string): boolean;
	/** 两个路径是否指向同一个文件(含符号链接与大小写不敏感的文件系统). */
	isSameFile(a: string, b: string): boolean;
}

function sameInode(a: string, b: string): boolean {
	try {
		const sa = statSync(a);
		const sb = statSync(b);
		return sa.dev === sb.dev && sa.ino === sb.ino;
	} catch {
		return false;
	}
}

export function createNodeIo(): CliIo {
	const cwd = process.cwd();
	// 下游提前关闭管道(如 `| head`)时忽略 EPIPE, 否则未处理的 error 事件会让进程崩溃并打印堆栈.
	process.stdout.on("error", (error: NodeJS.ErrnoException) => {
		if (error.code !== "EPIPE") throw error;
	});
	return {
		cwd,
		stdout: text => void process.stdout.write(text),
		stderr: text => void process.stderr.write(text),
		readFile: path => readFileSync(resolve(cwd, path), "utf8"),
		readStdin: () => readFileSync(0, "utf8"),
		writeFile: (path, text) => writeFileSync(resolve(cwd, path), text, "utf8"),
		exists: path => existsSync(resolve(cwd, path)),
		isSameFile: (a, b) => {
			const ra = resolve(cwd, a);
			const rb = resolve(cwd, b);
			return ra === rb || sameInode(ra, rb);
		},
	};
}
