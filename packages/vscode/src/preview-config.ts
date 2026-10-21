// 预览中扩展组件模块的本地路径: 把相对路径, 盘符路径与 file: 地址解析为绝对文件路径, 并为 schema 中 webview 无法自行解析的本地地址生成 import map.
import * as nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { isDrivePath, isRelativeModule, schemaModuleRefs } from "./preview-modules.js";

/** 路径实现; 缺省为当前平台, 测试可传 path.win32 模拟 Windows. */
export type PathApi = Pick<typeof nodePath, "resolve" | "isAbsolute" | "dirname" | "sep">;

/**
 * ./ ../ 按 baseDir 解析, / 开头, 盘符路径(仅 Windows 路径实现下是绝对路径)与 file: 地址取绝对路径;
 * 其余(https 等)不是本地文件, 返回 undefined.
 */
export function localModulePath(
	module: string,
	baseDir: string,
	path: PathApi = nodePath
): string | undefined {
	if (module.startsWith("file:")) {
		try {
			return fileURLToPath(module, { windows: path.sep === "\\" });
		} catch {
			return undefined;
		}
	}
	if (isRelativeModule(module) || (isDrivePath(module) && path.isAbsolute(module)))
		return path.resolve(baseDir, module);
	return undefined;
}

export interface SchemaModuleImports {
	/** 模块地址原文 → webview 地址; 写进 import map, 让 import() 原样拿到的 file: 与盘符地址指向 webview 地址. */
	imports: Record<string, string>;
	/** 本地模块所在目录, 供 localResourceRoots 放行. */
	dirs: string[];
}

/**
 * schema 根 x-ui.widgets 中的本地模块: 收集所在目录; 其中 file: 与盘符地址 webview 无法按基准地址解析, 生成地址原文到 webview 地址的映射.
 * ./ ../ / 开头的地址由 webview 按文档目录的 webview 地址解析, 不进映射.
 */
export function schemaModuleImports(
	schema: unknown,
	documentDir: string,
	toWebviewUrl: (file: string) => string,
	path: PathApi = nodePath
): SchemaModuleImports {
	const imports: Record<string, string> = {};
	const dirs = new Set<string>();
	for (const ref of Object.values(schemaModuleRefs(schema))) {
		const file = localModulePath(ref.module, documentDir, path);
		if (file === undefined) continue;
		dirs.add(path.dirname(file));
		if (!isRelativeModule(ref.module)) imports[ref.module] = toWebviewUrl(file);
	}
	return { imports, dirs: [...dirs] };
}
